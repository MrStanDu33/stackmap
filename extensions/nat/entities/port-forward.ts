import { TRANSPORTS } from '@stackmap/extension-core/entities';
import { defineEntitySchema, entityId, ipAddress, line, port } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

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

const isIpv6 = (address: string) => address.includes(':');

export const portForwardSchema: EntitySchema<PortForwardFields, PortForwardInput> = defineEntitySchema({
  hostId: entityId(),
  externalAddress: ipAddress(),
  externalPort: port(),
  transport: z.enum(TRANSPORTS),
  internalAddress: ipAddress(),
  internalPort: port(),
  description: line(200).nullable().default(null),
}, (forward: PortForwardFields, context) => {
  // NAT66 and NAT64 are out of scope: a forward stays within one IP version.
  if (isIpv6(forward.externalAddress) !== isIpv6(forward.internalAddress)) {
    context.addIssue({
      code: 'custom',
      path: ['internalAddress'],
      message: `${forward.internalAddress} is not of the same IP version as ${forward.externalAddress}`,
    });
  }
  return forward;
});
