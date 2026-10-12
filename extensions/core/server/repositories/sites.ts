import type { Site, SiteInput, SitePatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type SiteRepository = ScopedRepository<Site, SiteInput, SitePatch>;
