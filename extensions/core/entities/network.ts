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
  name: entityName().meta({ description: 'The network\'s name', examples: ['LAN'] }),
  kind: kindId().meta({ description: 'The network kind, from an active extension', examples: ['lan'] }),
  cidr: cidr().nullable().default(null).meta({ description: 'The address range, normalized', examples: ['192.0.2.0/24'] }),
  vlan: z.number().int().min(1).max(4094).nullable().default(null).meta({ description: 'The VLAN id', examples: [10] }),
  siteId: entityId().nullable().default(null).meta({ description: 'The site the network is in', examples: ['0199d6a0-0000-7000-8000-000000000001'] }),
});
