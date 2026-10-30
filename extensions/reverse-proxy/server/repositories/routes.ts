import type { ProxyRoute, ProxyRouteInput, ProxyRoutePatch } from '../../entities';
import type { ScopedRepository } from '@stackmap/extension-sdk/server';

export type ProxyRouteRepository = ScopedRepository<
  ProxyRoute, ProxyRouteInput, ProxyRoutePatch, { proxyServiceId?: string; upstreamListenerId?: string }
>;
