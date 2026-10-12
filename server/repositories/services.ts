import { defineEntityRepository } from './entity-repository';
import { serviceSchema } from '../../shared/entities';

import type { ScopedRepository } from './entity-repository';
import type { Service, ServiceFields, ServiceInput, ServicePatch } from '../../shared/entities';

type ServiceFilter = { hostId?: string };

export type ServiceRepository = ScopedRepository<Service, ServiceInput, ServicePatch, ServiceFilter>;

/** A service's listeners belong to it: the database deletes them with it. */
export const serviceRepository = defineEntityRepository<
  Service, ServiceFields, ServiceInput, ServicePatch, ServiceFilter
>({
  table: 'service',
  schema: serviceSchema,
  columns: ['name', 'kind', 'hostId', 'image', 'containerName'],
  kinds: { kind: 'service' },
  filters: ['hostId'],
  references: ({ hostId }) => (hostId ? [{ field: 'hostId', table: 'host', id: hostId }] : []),
});
