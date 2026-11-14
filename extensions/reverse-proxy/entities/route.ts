import { ASCII, defineEntitySchema, DNS_CHARACTERS, whenValid, entityId, normalizeDnsName, normalizeIp } from '@stackmap/extension-sdk/entities';
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

const hostname = () => z.string().max(255).regex(DNS_CHARACTERS)
  .refine((text) => (normalizeHostname(text)?.length ?? Infinity) <= 253, {
    message: 'Expected a hostname, such as app.homelab.example or *.homelab.example',
    params: { code: 'reverse-proxy.invalid-hostname' },
    when: whenValid,
  })
  .overwrite((text) => normalizeHostname(text) ?? text);

export const proxyRouteSchema: EntitySchema<ProxyRouteFields, ProxyRouteInput> = defineEntitySchema({
  proxyServiceId: entityId().meta({ description: 'The reverse proxy service that serves the route', examples: ['0199d6a0-0000-7000-8000-000000000003'] }),
  hostnames: z.array(hostname()).min(1).max(MAX_HOSTNAMES).meta({ description: 'The hostnames the route serves', examples: [['blog.homelab.example']] }),
  upstreamListenerId: entityId().meta({ description: 'The listener it forwards to', examples: ['0199d6a0-0000-7000-8000-000000000005'] }),
  forceSsl: z.boolean().default(false).meta({ description: 'Whether plain HTTP is redirected to HTTPS', examples: [true] }),
  websockets: z.boolean().default(false).meta({ description: 'Whether WebSocket upgrades are passed on', examples: [false] }),
}, (route: ProxyRouteFields, context) => {
  const twice = route.hostnames.find((name, index) => route.hostnames.indexOf(name) !== index);
  if (twice !== undefined) {
    context.addIssue({ code: 'custom', path: ['hostnames'], message: `${twice} is listed twice`, params: { code: 'reverse-proxy.duplicate-hostname', hostname: twice } });
  }
  return route;
});
