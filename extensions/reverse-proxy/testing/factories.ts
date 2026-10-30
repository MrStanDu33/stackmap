import { randomUUID } from 'node:crypto';

import { createListener, createService } from '@stackmap/extension-core/testing';

import type { ProxyRoute, ProxyRouteInput } from '../entities';
import type {} from '../server/repositories';
import type { EntityRepositories } from '@stackmap/extension-sdk/server';

/*
 * Test data for proxy routes, like the core's factories: `buildProxyRoute` returns valid input without a database,
 * `createProxyRoute` stores it, creating the proxy service and the upstream listener unless given.
 */

let sequence = 0;

export function buildProxyRoute(overrides: Partial<ProxyRouteInput> = {}): ProxyRouteInput {
  sequence += 1;
  return {
    proxyServiceId: randomUUID(),
    hostnames: [`route-${String(sequence)}.homelab.example`],
    upstreamListenerId: randomUUID(),
    ...overrides,
  };
}

export async function createProxyRoute(
  repos: EntityRepositories,
  overrides: Partial<ProxyRouteInput> = {},
): Promise<ProxyRoute> {
  const proxyServiceId = overrides.proxyServiceId ?? (await createService(repos, { kind: 'reverse-proxy' })).id;
  const upstreamListenerId = overrides.upstreamListenerId ?? (await createListener(repos)).id;
  return repos.proxyRoutes.create(buildProxyRoute({ ...overrides, proxyServiceId, upstreamListenerId }));
}
