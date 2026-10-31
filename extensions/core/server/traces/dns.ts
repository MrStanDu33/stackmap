import { servesHostname } from '@stackmap/extension-sdk/server';

import { MAX_CNAME_STEPS } from '../flows/dns';

import type { DnsFlowEntities } from '../flows/dns';
import type { TraceHop, TraceHopResolver } from '@stackmap/extension-sdk/server';

/**
 * The records on a hostname's resolution chain, among a flow's basis records, as DNS hops in chain order: the
 * records naming it (exactly when some do, else by wildcard), then those of each CNAME's target.
 */
export function resolveDnsHops(
  { domains, dnsRecords }: Pick<DnsFlowEntities, 'domains' | 'dnsRecords'>,
  hostname: string,
  ids: readonly string[],
): TraceHop[] {
  const domainNames = new Map(domains.map(({ id, name }) => [id, name]));
  const given = new Set(ids);
  const records = dnsRecords.filter(({ id, domainId }) => given.has(id) && domainNames.has(domainId))
    .map((record) => {
      const domain = domainNames.get(record.domainId) ?? '';
      return { ...record, fqdn: record.name === '@' ? domain : `${record.name}.${domain}` };
    });
  const hops: TraceHop[] = [];
  const seen = new Set<string>();
  let names = [hostname];
  for (let step = 0; step <= MAX_CNAME_STEPS && names.length > 0; step += 1) {
    const next: string[] = [];
    for (const name of names.filter((candidate) => !seen.has(candidate))) {
      seen.add(name);
      const exact = records.filter(({ fqdn }) => fqdn === name);
      for (const record of exact.length > 0 ? exact : records.filter(({ fqdn }) => servesHostname(fqdn, name))) {
        const alias = record.type === 'CNAME';
        hops.push({
          entity: 'dns-record',
          id: record.id,
          stage: 'dns',
          label: alias ? 'extensions.core.trace.alias' : 'extensions.core.trace.address',
          params: { name: record.fqdn, [alias ? 'target' : 'address']: record.value, view: record.view },
        });
        if (alias) {
          next.push(record.value);
        }
      }
    }
    names = next;
  }
  return hops;
}

export const dnsRecordHopResolver: TraceHopResolver = {
  entity: 'dns-record',
  resolve: async ({ hostname, ids, read }) => {
    const [domains, dnsRecords] = await Promise.all([read.domains.list(), read.dnsRecords.list()]);
    return resolveDnsHops({ domains, dnsRecords }, hostname, ids);
  },
};
