import { defineEntityRepository } from './entity-repository';
import { siteSchema } from '../../shared/entities';

import type { ScopedRepository } from './entity-repository';
import type { Site, SiteFields, SiteInput, SitePatch } from '../../shared/entities';

export type SiteRepository = ScopedRepository<Site, SiteInput, SitePatch>;

export const siteRepository = defineEntityRepository<Site, SiteFields, SiteInput, SitePatch>({
  table: 'site',
  schema: siteSchema,
  columns: ['name'],
  dependents: [{ table: 'host', column: 'siteId' }, { table: 'network', column: 'siteId' }],
});
