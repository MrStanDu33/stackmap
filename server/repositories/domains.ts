import type { ScopedRepository } from './entity-repository';
import type { Domain, DomainInput, DomainPatch } from '../../shared/entities';

export type DomainRepository = ScopedRepository<Domain, DomainInput, DomainPatch>;
