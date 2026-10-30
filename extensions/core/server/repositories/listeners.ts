import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { listenerSchema } from '../../entities';

import type { Listener, ListenerFields, ListenerInput, ListenerPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type ListenerRepository = ScopedRepository<Listener, ListenerInput, ListenerPatch, { serviceId?: string }>;

export const listenerRepository = defineEntityRepository<ListenerFields, ListenerInput>({
  entity: 'listener',
  key: 'listeners',
  table: 'core_listener',
  schema: listenerSchema,
  columns: ['serviceId', 'port', 'transport', 'protocol', 'bindAddress', 'publishedPort'],
  kinds: { protocol: 'protocol' },
  filters: ['serviceId'],
  references: ({ serviceId }) => [{ field: 'serviceId', table: 'core_service', id: serviceId }],
  dependents: [{ entity: 'flow', table: 'core_flow', column: 'targetListenerId' }],
});
