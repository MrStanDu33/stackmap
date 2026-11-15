import { defineEntitySchema, entityId, kindId, line } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

/** A flow documented by hand: one service calling a listener, such as an app and its database. */
export interface FlowFields extends CommonFields {
  sourceServiceId: string;
  targetListenerId: string;
  /** A `protocol` kind of an active extension; null for the target listener's. */
  protocol: string | null;
  /** What the source uses it for. */
  purpose: string | null;
  /** Null when unknown. */
  encrypted: boolean | null;
}

export type Flow = EntityMeta & FlowFields;
export type FlowInput = CommonInput & {
  sourceServiceId: string;
  targetListenerId: string;
  protocol?: string | null;
  purpose?: string | null;
  encrypted?: boolean | null;
};
export type FlowPatch = Partial<FlowInput>;

export const flowSchema: EntitySchema<FlowFields, FlowInput> = defineEntitySchema({
  sourceServiceId: entityId().meta({ description: 'The service that opens the connection', examples: ['0199d6a0-0000-7000-8000-000000000003'] }),
  targetListenerId: entityId().meta({ description: 'The listener it connects to', examples: ['0199d6a0-0000-7000-8000-000000000005'] }),
  protocol: kindId().nullable().default(null).meta({ description: 'The application protocol, from an active extension', examples: ['https'] }),
  purpose: line(200).nullable().default(null).meta({ description: 'Why the connection exists', examples: ['Backups'] }),
  encrypted: z.boolean().nullable().default(null).meta({ description: 'Whether the traffic is encrypted, null when unknown', examples: [true] }),
});
