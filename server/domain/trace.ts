import { servesHostname, TRACE_STAGES, traceHopsSchema } from '@stackmap/extension-sdk/server';

import {
  MAX_TRACE_DEPENDENCY_DEPTH, MAX_TRACE_NODES, MAX_TRACE_STEP_HOPS, MAX_TRACE_STEPS,
} from '../../shared/contracts/traces';

import type { Trace, TraceNode, TraceStep } from '../../shared/contracts/traces';
import type { RegisteredTraceHopResolver } from '../extensions/registry';
import type { ExtensionLogger } from '@stackmap/extension-sdk';
import type { FlowBasis, FlowClient, FlowReader, TraceHop } from '@stackmap/extension-sdk/server';

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

/** What one resolver call reads through, ended once the call returns, fails or times out. */
export interface ResolverReader {
  read: FlowReader;
  end: (reason: 'finished' | 'failed' | 'timed out') => void;
}

export interface TraceOptions {
  resolvers: readonly RegisteredTraceHopResolver[];
  /** A reader for one resolver call, named after its owner (`trace hop resolver "route"`). */
  reader: (owner: string) => ResolverReader;
  /** The logger of a resolver's extension, for its failures. */
  logger: (extension: string) => ExtensionLogger;
  timeoutMs?: number;
}

export const RESOLVER_TIMEOUT_MS = 5000;

/** The flows serving a name: those naming it exactly when there are some, as DNS does, else the wildcard ones. */
function serving(flows: readonly TraceFlow[], hostname: string): TraceFlow[] {
  const exact = flows.filter(({ hostnames }) => hostnames.includes(hostname));
  return exact.length > 0
    ? exact
    : flows.filter(({ hostnames }) => hostnames.some((name) => servesHostname(name, hostname)));
}

/** One hop for all of an entity's basis entries that no resolver describes, counting them. */
const genericHop = (entity: string, basis: readonly FlowBasis[]): TraceHop[] => [{
  entity, id: basis[0]?.id ?? '', stage: 'network', label: 'trace.hop.unknown',
  params: { entity, count: String(basis.length) },
}];

class ResolverTimeoutError extends Error {
  override name = 'ResolverTimeoutError';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ResolverTimeoutError(`timed out after ${String(timeoutMs)} ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** At most MAX_TRACE_STEP_HOPS hops: past it, the last one counts those left out. */
function capped(hops: TraceHop[]): TraceHop[] {
  const kept = MAX_TRACE_STEP_HOPS - 1;
  const first = hops[kept];
  if (hops.length <= MAX_TRACE_STEP_HOPS || !first) {
    return hops;
  }
  return [
    ...hops.slice(0, kept),
    { entity: first.entity, id: first.id, stage: first.stage, label: 'trace.hop.more', params: { count: String(hops.length - kept) } },
  ];
}

/**
 * Describes a flow's basis as hops, one resolver call per entity, ordered by stage then basis order. A basis entity
 * no resolver knows, or whose resolver fails, gets a generic hop: the trace never breaks on an extension, and a
 * resolver that failed once is not called again for the trace.
 */
function hopResolver(hostname: string, { resolvers, reader, logger, timeoutMs = RESOLVER_TIMEOUT_MS }: TraceOptions) {
  const byEntity = new Map(resolvers.map((registered) => [registered.resolver.entity, registered]));
  const failed = new Set<string>();
  const call = async (registered: RegisteredTraceHopResolver, basis: FlowBasis[]): Promise<TraceHop[] | undefined> => {
    const { entity } = registered.resolver;
    const log = logger(registered.extension);
    const ids = basis.map(({ id }) => id);
    const owner = `trace hop resolver "${entity}"`;
    const { read, end } = reader(owner);
    try {
      const result = traceHopsSchema.safeParse(
        await withTimeout(registered.resolver.resolve({ hostname, ids, read }), timeoutMs),
      );
      end('finished');
      // Labels in its own namespace only: an extension cannot speak with the app's or another extension's words.
      const namespace = `extensions.${registered.extension}.`;
      if (!result.success || result.data.some(({ label }) => !label.startsWith(namespace))) {
        log.error(`${owner} returned an invalid result: `
          + (result.success ? `labels outside ${namespace}` : `${String(result.error.issues.length)} issues`));
        return undefined;
      }
      const given = new Set(ids);
      const hops = result.data.filter((hop) => hop.entity === entity && given.has(hop.id));
      if (hops.length < result.data.length) {
        log.warn(`${owner} returned hops for entities it was not given; they are left out`);
      }
      return hops;
    } catch (error) {
      end(error instanceof ResolverTimeoutError ? 'timed out' : 'failed');
      log.error(`${owner} failed: ${error instanceof Error ? error.message : String(error)}`, error);
      return undefined;
    }
  };
  const resolveEntity = async (entity: string, basis: FlowBasis[]): Promise<TraceHop[]> => {
    const registered = byEntity.get(entity);
    const hops = registered && !failed.has(entity) ? await call(registered, basis) : undefined;
    if (registered && !hops) {
      failed.add(entity);
    }
    return hops ?? genericHop(entity, basis);
  };
  const cache = new Map<string, Promise<TraceHop[]>>();
  const stageOf = (hop: TraceHop) => TRACE_STAGES.indexOf(hop.stage);
  return (flow: TraceFlow): Promise<TraceHop[]> => {
    let hops = cache.get(flow.id);
    if (!hops) {
      const groups = new Map<string, FlowBasis[]>();
      for (const item of flow.basis) {
        const group = groups.get(item.entity);
        if (group) {
          group.push(item);
        } else {
          groups.set(item.entity, [item]);
        }
      }
      hops = Promise.all([...groups].map(([entity, basis]) => resolveEntity(entity, basis)))
        .then((resolved) => capped(resolved.flat().sort((a, b) => stageOf(a) - stageOf(b))));
      cache.set(flow.id, hops);
    }
    return hops;
  };
}

/** A listener reached by the walk, how, and the listeners on the path to it. */
interface Visit {
  listenerId: string;
  role: TraceStep['role'];
  depth: number;
  path: ReadonlySet<string>;
}

/**
 * Walks the flows from the client to the hostname, then the dependencies of the services reached, breadth first.
 * From a listener on the request path, flows serving the name continue the request; from any listener, flows without
 * names are dependencies. A listener is one node however many steps reach it, and is followed once.
 */
export async function computeTrace(
  { flows, listeners, services, hosts }: TraceEntities,
  { hostname, port, client }: TraceRequest,
  options: TraceOptions,
): Promise<Trace> {
  const listenerById = new Map(listeners.map((listener) => [listener.id, listener]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const hostById = new Map(hosts.map((host) => [host.id, host]));
  const fromService = new Map<string, TraceFlow[]>();
  for (const flow of flows) {
    if (flow.sourceServiceId !== null) {
      const outgoing = fromService.get(flow.sourceServiceId);
      if (outgoing) {
        outgoing.push(flow);
      } else {
        fromService.set(flow.sourceServiceId, [flow]);
      }
    }
  }
  const hopsOf = hopResolver(hostname, options);

  const nodes = new Map<string, TraceNode>([['client', { id: 'client', type: 'client' }]]);
  const steps: TraceStep[] = [];
  const queue: Visit[] = [];
  let truncated = false;

  const nodeOf = (listenerId: string): TraceNode | undefined => {
    const listener = listenerById.get(listenerId);
    const service = listener && serviceById.get(listener.serviceId);
    if (!listener || !service) {
      return undefined;
    }
    const host = service.hostId === null ? undefined : hostById.get(service.hostId);
    return {
      id: listener.id,
      type: 'listener',
      listener: {
        id: listener.id, port: listener.port, transport: listener.transport, protocol: listener.protocol,
        publishedPort: listener.publishedPort, serviceId: service.id, serviceName: service.name,
        hostId: host?.id ?? null, hostName: host?.name ?? null,
      },
    };
  };
  /** Adds a step and, unless it closes a cycle, the node it reaches; false once the trace is full. */
  const follow = (flow: TraceFlow, hops: TraceHop[], from: string, visit: Omit<Visit, 'listenerId'>): boolean => {
    const target = flow.targetListenerId;
    const cycle = visit.path.has(target);
    const node = nodes.has(target) ? undefined : nodeOf(target);
    if (!nodes.has(target) && !node) {
      return true;
    }
    if (steps.length >= MAX_TRACE_STEPS || (node && nodes.size >= MAX_TRACE_NODES)) {
      truncated = true;
      queue.length = 0;
      return false;
    }
    steps.push({
      id: `${flow.id}:${from}`, source: from, target, role: visit.role, depth: visit.depth, cycle,
      flow: {
        id: flow.id, origin: flow.origin, extension: flow.extension, deriver: flow.deriver, protocol: flow.protocol,
        encrypted: flow.encrypted, purpose: flow.purpose,
      },
      hops,
    });
    if (node && !cycle) {
      nodes.set(target, node);
      queue.push({ ...visit, listenerId: target, path: new Set([...visit.path, target]) });
    }
    return true;
  };

  const entries = serving(flows.filter(({ sourceClient }) => sourceClient === client), hostname);
  for (const flow of entries) {
    const hops = await hopsOf(flow);
    const listener = listenerById.get(flow.targetListenerId);
    const entryPort = hops.find((hop) => hop.port !== undefined)?.port ?? listener?.publishedPort ?? listener?.port;
    const kept = port === null || entryPort === port;
    if (kept && !follow(flow, hops, 'client', { role: 'request', depth: 0, path: new Set() })) {
      break;
    }
  }
  for (let visit = queue.shift(); visit; visit = queue.shift()) {
    const { listenerId, role, depth, path } = visit;
    const outgoing = fromService.get(listenerById.get(listenerId)?.serviceId ?? '') ?? [];
    // A route to the listener the request arrived at serves the name on that port: the request has arrived.
    const requests = role === 'request'
      ? serving(outgoing.filter(({ hostnames }) => hostnames.length > 0), hostname)
          .filter(({ targetListenerId }) => targetListenerId !== listenerId)
      : [];
    const dependencies = depth < MAX_TRACE_DEPENDENCY_DEPTH
      ? outgoing.filter(({ hostnames }) => hostnames.length === 0)
      : [];
    for (const [flow, next] of [
      ...requests.map((flow) => [flow, { role: 'request', depth: 0, path }] as const),
      ...dependencies.map((flow) => [flow, { role: 'dependency', depth: depth + 1, path }] as const),
    ]) {
      if (!follow(flow, await hopsOf(flow), listenerId, next)) {
        break;
      }
    }
  }

  return { hostname, port, client, truncated, nodes: [...nodes.values()], steps };
}
