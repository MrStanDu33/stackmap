import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { serviceSchema } from '../../entities';

import type { Service, ServiceFields, ServiceInput, ServicePatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type ServiceRepository = ScopedRepository<Service, ServiceInput, ServicePatch, { hostId?: string }>;

/** A service's listeners belong to it: the database deletes them with it. */
export const serviceRepository = defineEntityRepository<ServiceFields, ServiceInput>({
  entity: 'service',
  key: 'services',
  table: 'core_service',
  schema: serviceSchema,
  columns: ['name', 'kind', 'hostId', 'image', 'containerName'],
  kinds: { kind: 'service' },
  filters: ['hostId'],
  references: ({ hostId }) => (hostId ? [{ field: 'hostId', table: 'core_host', id: hostId }] : []),
  dependents: [
    { entity: 'flow', table: 'core_flow', column: 'sourceServiceId' },
    // Removing a service removes its listeners: explains which flows to them blocked it.
    { entity: 'flow', table: 'core_flow', column: 'targetListenerId', through: { table: 'core_listener', column: 'serviceId' } },
  ],
});
