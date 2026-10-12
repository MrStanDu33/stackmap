import type { ScopedRepository } from './entity-repository';
import type { Host, HostInput, HostPatch } from '../../shared/entities';

export type HostRepository = ScopedRepository<Host, HostInput, HostPatch, { siteId?: string }>;
