import type { Flow, FlowInput, FlowPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type FlowRepository = ScopedRepository<
  Flow, FlowInput, FlowPatch, { sourceServiceId?: string; targetListenerId?: string }
>;
