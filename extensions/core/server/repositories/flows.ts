import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { flowSchema } from '../../entities';

import type { Flow, FlowFields, FlowInput, FlowPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type FlowRepository = ScopedRepository<
  Flow, FlowInput, FlowPatch, { sourceServiceId?: string; targetListenerId?: string }
>;

/** Flows documented by hand; derived flows are the server's, refreshed after every write. */
export const flowRepository = defineEntityRepository<FlowFields, FlowInput>({
  entity: 'flow',
  key: 'flows',
  table: 'core_flow',
  schema: flowSchema,
  columns: ['sourceServiceId', 'targetListenerId', 'protocol', 'purpose', 'encrypted'],
  booleans: ['encrypted'],
  kinds: { protocol: 'protocol' },
  filters: ['sourceServiceId', 'targetListenerId'],
  references: ({ sourceServiceId, targetListenerId }) => [
    { field: 'sourceServiceId', table: 'core_service', id: sourceServiceId },
    { field: 'targetListenerId', table: 'core_listener', id: targetListenerId },
  ],
});
