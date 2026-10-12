import { defineEntityRepository } from './entity-repository';
import { domainSchema } from '../../shared/entities';

import type { ScopedRepository } from './entity-repository';
import type { Domain, DomainFields, DomainInput, DomainPatch } from '../../shared/entities';

export type DomainRepository = ScopedRepository<Domain, DomainInput, DomainPatch>;

/** A domain's DNS records belong to it: the database deletes them with it. */
export const domainRepository = defineEntityRepository<Domain, DomainFields, DomainInput, DomainPatch>({
  table: 'domain',
  schema: domainSchema,
  columns: ['name'],
  unique: ['name'],
});
