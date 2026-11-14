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
  serviceId: entityId().meta({ description: 'The service that listens', examples: ['0199d6a0-0000-7000-8000-000000000003'] }),
  port: port().meta({ description: 'The port it listens on', examples: [443] }),
  transport: z.enum(TRANSPORTS).meta({ description: 'The transport protocol', examples: ['tcp'] }),
  protocol: kindId().nullable().default(null).meta({ description: 'The application protocol, from an active extension', examples: ['https'] }),
  bindAddress: ipAddress().nullable().default('0.0.0.0').meta({ description: 'The address it is bound to; 0.0.0.0 or :: for every address', examples: ['0.0.0.0'] }),
  publishedPort: port().nullable().default(null).meta({ description: 'The host port a container publishes it on', examples: [8443] }),
}, (listener: ListenerFields, context) => {
  if (listener.publishedPort !== null && listener.bindAddress === null) {
    context.addIssue({ code: 'custom', path: ['bindAddress'], message: 'A published port is bound to an address', params: { code: 'core.published-port-bound' } });
  }
  return listener;
});
