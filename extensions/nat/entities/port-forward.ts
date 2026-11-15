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
  hostId: entityId().meta({ description: 'The host that forwards, such as the router', examples: ['0199d6a0-0000-7000-8000-000000000002'] }),
  externalAddress: ipAddress().meta({ description: 'The address it receives on', examples: ['203.0.113.10'] }),
  externalPort: port().meta({ description: 'The port it receives on', examples: [443] }),
  transport: z.enum(TRANSPORTS).meta({ description: 'The transport protocol', examples: ['tcp'] }),
  internalAddress: ipAddress().meta({ description: 'The address it forwards to', examples: ['192.0.2.20'] }),
  internalPort: port().meta({ description: 'The port it forwards to', examples: [8443] }),
  description: line(200).nullable().default(null).meta({ description: 'What the forward is for', examples: ['Blog'] }),
}, (forward: PortForwardFields, context) => {
  // NAT66 and NAT64 are out of scope: a forward stays within one IP version.
  if (isIpv6(forward.externalAddress) !== isIpv6(forward.internalAddress)) {
    context.addIssue({
      code: 'custom',
      path: ['internalAddress'],
      message: 'Expected an address of the same IP version as the external one',
      params: { code: 'nat.ip-version-mismatch' },
    });
  }
  return forward;
});
