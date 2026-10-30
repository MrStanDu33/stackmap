import { proxyRouteRepository } from './routes';

import type { ProxyRouteRepository } from './routes';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';

declare module '@stackmap/extension-sdk/server' {
  interface EntityRepositories {
    proxyRoutes: ProxyRouteRepository;
  }
}

export type { ProxyRouteRepository };

/** The extension's repository definitions, one per entity its manifest declares. */
export const REPOSITORIES: readonly EntityRepositoryDefinition[] = [
  proxyRouteRepository,
] as readonly EntityRepositoryDefinition[];
