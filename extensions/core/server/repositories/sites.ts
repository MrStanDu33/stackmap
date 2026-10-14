import { defineEntityRepository } from '@stackmap/extension-sdk/server';

import { siteSchema } from '../../entities';

import type { Site, SiteFields, SiteInput, SitePatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type SiteRepository = ScopedRepository<Site, SiteInput, SitePatch>;

export const siteRepository = defineEntityRepository<SiteFields, SiteInput>({
  entity: 'site',
  key: 'sites',
  table: 'core_site',
  schema: siteSchema,
  columns: ['name'],
  dependents: [
    { entity: 'host', table: 'core_host', column: 'siteId' },
    { entity: 'network', table: 'core_network', column: 'siteId' },
  ],
});
