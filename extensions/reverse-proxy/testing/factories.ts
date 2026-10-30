import type { ProxyRoute, ProxyRouteInput } from '../entities';
import type {} from '../server/repositories';
import type { EntityRepositories } from '@stackmap/extension-sdk/server';

type Repositories = Pick<EntityRepositories, 'services' | 'listeners' | 'proxyRoutes'>;

export function buildProxyRoute(_overrides: Partial<ProxyRouteInput> = {}): ProxyRouteInput {
  throw new Error('Not implemented');
}

export function createProxyRoute(_repos: Repositories, _overrides: Partial<ProxyRouteInput> = {}): Promise<ProxyRoute> {
  throw new Error('Not implemented');
}
