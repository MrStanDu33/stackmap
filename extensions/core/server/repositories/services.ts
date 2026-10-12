import type { Service, ServiceInput, ServicePatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type ServiceRepository = ScopedRepository<Service, ServiceInput, ServicePatch, { hostId?: string }>;
