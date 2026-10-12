import { unimplementedSchema } from '@stackmap/extension-sdk/entities';

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

export const networkSchema: EntitySchema<NetworkFields, NetworkInput> = unimplementedSchema();
