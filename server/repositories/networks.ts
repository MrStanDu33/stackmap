import { defineEntityRepository } from './entity-repository';
import { networkSchema } from '../../shared/entities';

import type { ScopedRepository } from './entity-repository';
import type { Network, NetworkFields, NetworkInput, NetworkPatch } from '../../shared/entities';

type NetworkFilter = { siteId?: string };

export type NetworkRepository = ScopedRepository<Network, NetworkInput, NetworkPatch, NetworkFilter>;

export const networkRepository = defineEntityRepository<
  Network, NetworkFields, NetworkInput, NetworkPatch, NetworkFilter
>({
  table: 'network',
  schema: networkSchema,
  columns: ['name', 'kind', 'cidr', 'vlan', 'siteId'],
  kinds: { kind: 'network' },
  filters: ['siteId'],
  references: ({ siteId }) => (siteId ? [{ field: 'siteId', table: 'site', id: siteId }] : []),
  dependents: [{ table: 'hostAddress', column: 'networkId' }],
});
