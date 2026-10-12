import { defineEntitySchema, entityName } from './common';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from './common';

/** A physical or logical location: a home, a datacenter, a cloud region. */
export interface SiteFields extends CommonFields {
  name: string;
}

export type Site = EntityMeta & SiteFields;
export type SiteInput = CommonInput & { name: string };
export type SitePatch = Partial<SiteInput>;

export const siteSchema: EntitySchema<SiteFields, SiteInput> = defineEntitySchema({ name: entityName() });
