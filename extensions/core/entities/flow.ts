import { defineEntitySchema } from '@stackmap/extension-sdk/entities';

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

export const flowSchema: EntitySchema<FlowFields, FlowInput> = defineEntitySchema({});
