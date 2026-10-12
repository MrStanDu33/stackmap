import { defineEntityRepository } from './entity-repository';
import { listenerSchema } from '../../shared/entities';

import type { ScopedRepository } from './entity-repository';
import type { Listener, ListenerFields, ListenerInput, ListenerPatch } from '../../shared/entities';

type ListenerFilter = { serviceId?: string };

export type ListenerRepository = ScopedRepository<Listener, ListenerInput, ListenerPatch, ListenerFilter>;

export const listenerRepository = defineEntityRepository<
  Listener, ListenerFields, ListenerInput, ListenerPatch, ListenerFilter
>({
  table: 'listener',
  schema: listenerSchema,
  columns: ['serviceId', 'port', 'transport', 'protocol', 'bindAddress', 'publishedPort'],
  kinds: { protocol: 'protocol' },
  filters: ['serviceId'],
  references: ({ serviceId }) => [{ field: 'serviceId', table: 'service', id: serviceId }],
});
