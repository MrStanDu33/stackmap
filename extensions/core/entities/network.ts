import { cidr, defineEntitySchema, entityId, entityName, kindId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

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
