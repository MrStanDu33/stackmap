import type { Trace } from '../../shared/contracts/traces';
import type { RegisteredTraceHopResolver } from '../extensions/registry';
import type { ExtensionLogger } from '@stackmap/extension-sdk';
import type { FlowBasis, FlowClient, FlowReader } from '@stackmap/extension-sdk/server';

/** A stored flow as the walk reads it: derived (with its deriver) or manual. */
export interface TraceFlow {
  id: string;
  origin: 'derived' | 'manual';
  extension: string | null;
  deriver: string | null;
  sourceServiceId: string | null;
  sourceClient: FlowClient | null;
  targetListenerId: string;
  protocol: string | null;
  encrypted: boolean | null;
  purpose: string | null;
  hostnames: readonly string[];
  basis: readonly FlowBasis[];
}

/** What a trace is computed from: the workspace's flows and the listeners, services and hosts they reach. */
export interface TraceEntities {
  flows: readonly TraceFlow[];
  listeners: readonly {
    id: string;
    serviceId: string;
    port: number;
    transport: string;
    protocol: string | null;
    publishedPort: number | null;
  }[];
  services: readonly { id: string; name: string; hostId: string | null }[];
  hosts: readonly { id: string; name: string }[];
}

export interface TraceRequest {
  hostname: string;
  port: number | null;
  client: FlowClient;
}

export interface TraceOptions {
  resolvers: readonly RegisteredTraceHopResolver[];
  read: FlowReader;
  /** The logger of a resolver's extension, for its failures. */
  logger: (extension: string) => ExtensionLogger;
  timeoutMs?: number;
}

export const RESOLVER_TIMEOUT_MS = 5000;

/** Walks the flows from the client to the hostname, then the dependencies of the services reached. */
export function computeTrace(_entities: TraceEntities, _request: TraceRequest, _options: TraceOptions): Promise<Trace> {
  return Promise.reject(new Error('computeTrace is not implemented yet.'));
}
