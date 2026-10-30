import type { ProxyRouteRepository } from './routes';

declare module '@stackmap/extension-sdk/server' {
  interface EntityRepositories {
    proxyRoutes: ProxyRouteRepository;
  }
}

export type { ProxyRouteRepository };
