import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { domainSchema } from '../../entities';

import type { Domain, DomainFields, DomainInput, DomainPatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type DomainRepository = ScopedRepository<Domain, DomainInput, DomainPatch>;

/** A domain's DNS records belong to it: the database deletes them with it. */
export const domainRepository = defineEntityRepository<DomainFields, DomainInput>({
  entity: 'domain',
  key: 'domains',
  table: 'core_domain',
  schema: domainSchema,
  columns: ['name'],
  unique: ['name'],
});
