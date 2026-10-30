import { ASCII, defineEntitySchema, entityId, normalizeDnsName, normalizeIp } from '@stackmap/extension-sdk/entities';
import { z } from 'zod';

import type { CommonFields, CommonInput, EntityMeta, EntitySchema } from '@stackmap/extension-sdk/entities';

export interface ProxyRouteFields extends CommonFields {
  /** A `reverse-proxy` service. */
  proxyServiceId: string;
  /** Lowercase DNS names, `*` allowed as the first label only: `*.homelab.example`. */
  hostnames: string[];
  /** Any listener, the proxy's own included. */
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

export const MAX_HOSTNAMES = 50;

/** The hostname lowercase without a trailing dot, or undefined when it is not one (an IP address is not). */
function normalizeHostname(text: string): string | undefined {
  const wildcard = text.startsWith('*.');
  const name = normalizeDnsName(wildcard ? text.slice(2) : text);
  if (name === undefined || !ASCII.test(text) || normalizeIp(text) !== undefined) {
    return undefined;
  }
  return wildcard ? `*.${name}` : name;
}

const hostname = () => z.string().max(255).transform((text, context) => {
  const name = normalizeHostname(text);
  if (name === undefined || name.length > 253) {
    context.addIssue({ code: 'custom', message: 'Expected a hostname, such as app.homelab.example or *.homelab.example' });
    return z.NEVER;
  }
  return name;
});

export const proxyRouteSchema: EntitySchema<ProxyRouteFields, ProxyRouteInput> = defineEntitySchema({
  proxyServiceId: entityId(),
  hostnames: z.array(hostname()).min(1).max(MAX_HOSTNAMES),
  upstreamListenerId: entityId(),
  forceSsl: z.boolean().default(false),
  websockets: z.boolean().default(false),
}, (route: ProxyRouteFields, context) => {
  const twice = route.hostnames.find((name, index) => route.hostnames.indexOf(name) !== index);
  if (twice !== undefined) {
    context.addIssue({ code: 'custom', path: ['hostnames'], message: `${twice} is listed twice` });
  }
  return route;
});
