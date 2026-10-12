import { z } from 'zod';

import { defineEntitySchema, entityId, entityName, kindId } from './common';
import { cidr } from './network-values';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from './common';

export interface NetworkFields extends CommonFields {
  name: string;
  /** A `network` kind of an active extension. */
  kind: string;
  cidr: string | null;
  vlan: number | null;
  siteId: string | null;
}

export type Network = EntityMeta & NetworkFields;
export type NetworkInput = CommonInput & {
  name: string;
  kind: string;
  cidr?: string | null;
  vlan?: number | null;
  siteId?: string | null;
};
export type NetworkPatch = Partial<NetworkInput>;

export const networkSchema: EntitySchema<NetworkFields, NetworkInput> = defineEntitySchema({
  name: entityName(),
  kind: kindId(),
  cidr: cidr().nullable().default(null),
  vlan: z.number().int().min(1).max(4094).nullable().default(null),
  siteId: entityId().nullable().default(null),
});
