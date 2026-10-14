import { defineEntitySchema, entityId, ipAddress, kindId, port } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

export const TRANSPORTS = ['tcp', 'udp'] as const;
export type Transport = (typeof TRANSPORTS)[number];

export interface ListenerFields extends CommonFields {
  serviceId: string;
  port: number;
  transport: Transport;
  /** A `protocol` kind of an active extension. */
  protocol: string | null;
  /** Null when the port is not bound on the host's interfaces: a container-network port, or an external service. */
  bindAddress: string | null;
  /** The host port a container port is published on. */
  publishedPort: number | null;
}

export type Listener = EntityMeta & ListenerFields;
export type ListenerInput = CommonInput & {
  serviceId: string;
  port: number;
  transport: Transport;
  protocol?: string | null;
  bindAddress?: string | null;
  publishedPort?: number | null;
};
export type ListenerPatch = Partial<ListenerInput>;

export const listenerSchema: EntitySchema<ListenerFields, ListenerInput> = defineEntitySchema({
  serviceId: entityId(),
  port: port(),
  transport: z.enum(TRANSPORTS),
  protocol: kindId().nullable().default(null),
  bindAddress: ipAddress().nullable().default('0.0.0.0'),
  publishedPort: port().nullable().default(null),
}, (listener: ListenerFields, context) => {
  if (listener.publishedPort !== null && listener.bindAddress === null) {
    context.addIssue({ code: 'custom', path: ['bindAddress'], message: 'A published port is bound to an address' });
  }
  return listener;
});
