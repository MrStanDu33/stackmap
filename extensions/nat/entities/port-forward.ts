import { defineEntitySchema } from '@stackmap/extension-sdk/entities';

import type { Transport } from '@stackmap/extension-core/entities';
import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

/** A port of a host's address forwarded to an internal address and port (destination NAT). */
export interface PortForwardFields extends CommonFields {
  /** The host that forwards: a router, a firewall, a VPS. */
  hostId: string;
  /** One of the host's addresses. */
  externalAddress: string;
  externalPort: number;
  transport: Transport;
  /** Of the same IP version as the external address. */
  internalAddress: string;
  internalPort: number;
  description: string | null;
}

export type PortForward = EntityMeta & PortForwardFields;
export type PortForwardInput = CommonInput & {
  hostId: string;
  externalAddress: string;
  externalPort: number;
  transport: Transport;
  internalAddress: string;
  internalPort: number;
  description?: string | null;
};
export type PortForwardPatch = Partial<PortForwardInput>;

export const portForwardSchema: EntitySchema<PortForwardFields, PortForwardInput> = defineEntitySchema({});
