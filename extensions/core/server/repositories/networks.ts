import type { Network, NetworkInput, NetworkPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type NetworkRepository = ScopedRepository<Network, NetworkInput, NetworkPatch, { siteId?: string }>;
