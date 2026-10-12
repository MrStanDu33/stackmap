import type { Domain, DomainInput, DomainPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type DomainRepository = ScopedRepository<Domain, DomainInput, DomainPatch>;
