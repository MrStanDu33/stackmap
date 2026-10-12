import type { ScopedRepository } from './entity-repository';
import type { Site, SiteInput, SitePatch } from '../../shared/entities';

export type SiteRepository = ScopedRepository<Site, SiteInput, SitePatch>;
