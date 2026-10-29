import { cidrContains } from '@stackmap/extension-sdk/entities';
import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { networkSchema } from '../../entities';

import type { Network, NetworkFields, NetworkInput, NetworkPatch } from '../../entities';
import type { CoreDatabase } from '../types/schema';
import type { EntityIssue } from '@stackmap/extension-sdk/entities';
import type { RepositoryContext, ScopedRepository } from '@stackmap/extension-sdk/server';

export type NetworkRepository = ScopedRepository<Network, NetworkInput, NetworkPatch, { siteId?: string }>;

/** Host addresses on the network that its CIDR leaves outside: the rule the host repository applies, seen from here. */
async function checkAddresses(
  { db, scope }: RepositoryContext<CoreDatabase>,
  { cidr }: NetworkFields,
  id: string,
): Promise<EntityIssue[]> {
  if (cidr === null) {
    return [];
  }
  const addresses = await db.selectFrom('core_hostAddress')
    .innerJoin('core_host', (join) => join
      .onRef('core_host.id', '=', 'core_hostAddress.hostId')
      .onRef('core_host.workspaceId', '=', 'core_hostAddress.workspaceId'))
    .select(['core_hostAddress.address', 'core_host.name'])
    .where('core_hostAddress.workspaceId', '=', scope.workspaceId)
    .where('core_hostAddress.networkId', '=', id)
    .orderBy('core_hostAddress.id')
    .execute();
  return addresses
    .filter(({ address }) => !cidrContains(cidr, address))
    .map(({ address, name }) => ({ path: 'cidr', message: `${address} (${name}) is not in ${cidr}` }));
}

export const networkRepository = defineEntityRepository<NetworkFields, NetworkInput, CoreDatabase>({
  entity: 'network',
  key: 'networks',
  table: 'core_network',
  schema: networkSchema,
  columns: ['name', 'kind', 'cidr', 'vlan', 'siteId'],
  kinds: { kind: 'network' },
  filters: ['siteId'],
  references: ({ siteId }) => (siteId ? [{ field: 'siteId', table: 'core_site', id: siteId }] : []),
  dependents: [{ entity: 'hostAddress', table: 'core_hostAddress', column: 'networkId' }],
  check: (context, network, changed, id) =>
    (changed.has('cidr') ? checkAddresses(context, network, id) : Promise.resolve([])),
});
