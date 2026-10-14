import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { networkSchema } from '../../entities';

import type { Network, NetworkFields, NetworkInput, NetworkPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type NetworkRepository = ScopedRepository<Network, NetworkInput, NetworkPatch, { siteId?: string }>;

export const networkRepository = defineEntityRepository<NetworkFields, NetworkInput>({
  entity: 'network',
  key: 'networks',
  table: 'core_network',
  schema: networkSchema,
  columns: ['name', 'kind', 'cidr', 'vlan', 'siteId'],
  kinds: { kind: 'network' },
  filters: ['siteId'],
  references: ({ siteId }) => (siteId ? [{ field: 'siteId', table: 'core_site', id: siteId }] : []),
  dependents: [{ entity: 'hostAddress', table: 'core_hostAddress', column: 'networkId' }],
});
