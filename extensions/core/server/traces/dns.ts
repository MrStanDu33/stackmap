import type { DnsFlowEntities } from '../flows/dns';
import type { TraceHop, TraceHopResolver } from '@stackmap/extension-sdk/server';

/** The records on a hostname's resolution chain, among a flow's basis records, as DNS hops in chain order. */
export function resolveDnsHops(
  _entities: Pick<DnsFlowEntities, 'domains' | 'dnsRecords'>,
  _hostname: string,
  _ids: readonly string[],
): TraceHop[] {
  return [];
}

export const dnsRecordHopResolver: TraceHopResolver = {
  entity: 'dns-record',
  resolve: async ({ hostname, ids, read }) => {
    const [domains, dnsRecords] = await Promise.all([read.domains.list(), read.dnsRecords.list()]);
    return resolveDnsHops({ domains, dnsRecords }, hostname, ids);
  },
};
