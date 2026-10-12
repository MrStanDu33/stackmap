import type { ScopedRepository } from './entity-repository';
import type { Service, ServiceInput, ServicePatch } from '../../shared/entities';

export type ServiceRepository = ScopedRepository<Service, ServiceInput, ServicePatch, { hostId?: string }>;
