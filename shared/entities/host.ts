import { unimplementedSchema } from './common';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from './common';

/** An IP address of a host, on a network when it is known. */
export interface HostAddress {
  address: string;
  networkId: string | null;
}

export interface HostFields extends CommonFields {
  name: string;
  /** A `host` kind of an active extension. */
  kind: string;
  os: string | null;
  siteId: string | null;
  addresses: HostAddress[];
}

export type Host = EntityMeta & HostFields;
export type HostInput = CommonInput & {
  name: string;
  kind: string;
  os?: string | null;
  siteId?: string | null;
  addresses?: { address: string; networkId?: string | null }[];
};
export type HostPatch = Partial<HostInput>;

export const hostSchema: EntitySchema<HostFields, HostInput> = unimplementedSchema();
