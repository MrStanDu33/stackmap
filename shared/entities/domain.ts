import { unimplementedSchema } from './common';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from './common';

export interface DomainFields extends CommonFields {
  /** Lowercase, without a trailing dot. */
  name: string;
}

export type Domain = EntityMeta & DomainFields;
export type DomainInput = CommonInput & { name: string };
export type DomainPatch = Partial<DomainInput>;

export const domainSchema: EntitySchema<DomainFields, DomainInput> = unimplementedSchema();
