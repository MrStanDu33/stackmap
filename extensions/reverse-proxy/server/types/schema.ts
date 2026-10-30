import type { CoreDatabase, EntityColumns } from '@stackmap/extension-core/server/types';

/** The extension's tables, as stored, with the core tables they refer to. */
export interface ReverseProxyDatabase extends CoreDatabase {
  reverse_proxy_route: RouteTable;
  reverse_proxy_routeHostname: RouteHostnameTable;
}

export interface RouteTable extends EntityColumns {
  proxyServiceId: string;
  upstreamListenerId: string;
  /** 0 or 1. */
  forceSsl: number;
  /** 0 or 1. */
  websockets: number;
}

/**
 * A route's hostnames, owned by the route and ordered by id. The proxy is copied from the route so a unique index can
 * keep one route per hostname on each proxy.
 */
export interface RouteHostnameTable {
  id: string;
  workspaceId: string;
  routeId: string;
  proxyServiceId: string;
  hostname: string;
}
