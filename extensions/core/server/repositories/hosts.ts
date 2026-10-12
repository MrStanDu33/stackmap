import type { Host, HostInput, HostPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type HostRepository = ScopedRepository<Host, HostInput, HostPatch, { siteId?: string }>;
