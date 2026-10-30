import { defineEntitySchema, entityId } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

export interface ProxyRouteFields extends CommonFields {
  /** A `reverse-proxy` service. */
  proxyServiceId: string;
  hostnames: string[];
  /** A listener of another service. */
  upstreamListenerId: string;
  forceSsl: boolean;
  websockets: boolean;
}

export type ProxyRoute = EntityMeta & ProxyRouteFields;
export type ProxyRouteInput = CommonInput & {
  proxyServiceId: string;
  hostnames: string[];
  upstreamListenerId: string;
  forceSsl?: boolean;
  websockets?: boolean;
};
export type ProxyRoutePatch = Partial<ProxyRouteInput>;

export const proxyRouteSchema: EntitySchema<ProxyRouteFields, ProxyRouteInput> = defineEntitySchema({
  proxyServiceId: entityId(),
  hostnames: z.array(z.string()),
  upstreamListenerId: entityId(),
  forceSsl: z.boolean(),
  websockets: z.boolean(),
});
