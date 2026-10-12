import type { ScopedRepository } from './entity-repository';
import type { Network, NetworkInput, NetworkPatch } from '../../shared/entities';

export type NetworkRepository = ScopedRepository<Network, NetworkInput, NetworkPatch, { siteId?: string }>;
