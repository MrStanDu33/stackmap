import type { PortForward, PortForwardInput, PortForwardPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type PortForwardRepository = ScopedRepository<
  PortForward, PortForwardInput, PortForwardPatch, { hostId?: string }
>;
