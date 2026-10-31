import { describe, expect, it, vi } from 'vitest';

import { computeTrace } from './trace';
import { MAX_TRACE_NODES, MAX_TRACE_STEPS } from '../../shared/contracts/traces';

import type { TraceEntities, TraceFlow, TraceOptions, TraceRequest } from './trace';
import type { Trace } from '../../shared/contracts/traces';
import type { RegisteredTraceHopResolver } from '../extensions/registry';
import type { ExtensionLogger } from '@stackmap/extension-sdk';
import type { FlowReader, TraceHop, TraceStage } from '@stackmap/extension-sdk/server';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const SERVER = { id: id(1), name: 'Home server' };
const NPM = { id: id(2), name: 'NPM', hostId: SERVER.id };
const APP = { id: id(3), name: 'App', hostId: SERVER.id };
const DB = { id: id(4), name: 'Database', hostId: SERVER.id };
const API = { id: id(5), name: 'Weather API', hostId: null };
const BACKUP = { id: id(6), name: 'Backup', hostId: SERVER.id };
const BLOG = { id: id(7), name: 'Blog', hostId: SERVER.id };

const listener = (n: number, service: { id: string }, port: number, publishedPort: number | null = port) =>
  ({ id: id(n), serviceId: service.id, port, transport: 'tcp', protocol: null, publishedPort });

const NPM_80 = listener(10, NPM, 80);
const NPM_443 = listener(11, NPM, 443);
const NPM_81 = listener(12, NPM, 81);
const APP_3000 = listener(13, APP, 3000, null);
const DB_5432 = listener(14, DB, 5432, null);
const API_443 = listener(15, API, 443, null);
const BACKUP_9000 = listener(16, BACKUP, 9000, null);
const BLOG_3000 = listener(17, BLOG, 3000, null);

const LISTENERS = [NPM_80, NPM_443, NPM_81, APP_3000, DB_5432, API_443, BACKUP_9000, BLOG_3000];
const SERVICES = [NPM, APP, DB, API, BACKUP, BLOG];

/** Readable names of the nodes, for the summaries. */
const NAMES = new Map<string, string>([
  ['client', 'client'],
  [NPM_80.id, 'npm:80'], [NPM_443.id, 'npm:443'], [NPM_81.id, 'npm:81'], [APP_3000.id, 'app:3000'],
  [DB_5432.id, 'db:5432'], [API_443.id, 'api:443'], [BACKUP_9000.id, 'backup:9000'], [BLOG_3000.id, 'blog:3000'],
]);
const nameOf = (nodeId: string) => NAMES.get(nodeId) ?? nodeId;

const RECORD = id(20);
const FORWARD_80 = id(30);
const FORWARD_443 = id(31);
const FORWARD_8443 = id(32);
const ROUTE_APP = id(40);
const ROUTE_BLOG = id(41);
const ROUTE_ADMIN = id(42);

let flowSequence = 100;

const derived = (overrides: Partial<TraceFlow> & Pick<TraceFlow, 'targetListenerId'>): TraceFlow => {
  flowSequence += 1;
  return {
    id: id(flowSequence), origin: 'derived', extension: 'core', deriver: 'dns', sourceServiceId: null, sourceClient: null,
    protocol: null, encrypted: null, purpose: null, hostnames: [], basis: [], ...overrides,
  };
};
const entry = (target: { id: string }, hostnames: string[], basis: TraceFlow['basis'], client: 'public' | 'internal' = 'public') =>
  derived({ sourceClient: client, targetListenerId: target.id, hostnames, basis });
const route = (routeId: string, target: { id: string }, hostnames: string[]) => derived({
  extension: 'reverse-proxy', deriver: 'routes', sourceServiceId: NPM.id, targetListenerId: target.id, hostnames,
  basis: [{ entity: 'route', id: routeId }],
});
const manual = (source: { id: string }, target: { id: string }) => derived({
  origin: 'manual', extension: null, deriver: null, sourceServiceId: source.id, targetListenerId: target.id,
});

const dns = { entity: 'dns-record', id: RECORD };
const forward = (forwardId: string) => ({ entity: 'port-forward', id: forwardId });

/** External ports of the forwards, as the NAT resolver gives them. */
const FORWARD_PORTS = new Map([[FORWARD_80, 80], [FORWARD_443, 443], [FORWARD_8443, 8443]]);

const fakeResolver = (extension: string, entity: string, stage: TraceStage): RegisteredTraceHopResolver => ({
  extension,
  resolver: {
    entity,
    resolve: ({ ids }) => Promise.resolve(ids.map((hopId): TraceHop => {
      const port = FORWARD_PORTS.get(hopId);
      return { entity, id: hopId, stage, label: `test.${entity}`, params: {}, ...(port === undefined ? {} : { port }) };
    })),
  },
});

const RESOLVERS = [
  fakeResolver('core', 'dns-record', 'dns'),
  fakeResolver('nat', 'port-forward', 'network'),
  fakeResolver('reverse-proxy', 'route', 'proxy'),
];

const silent = (): ExtensionLogger => ({ info: () => undefined, warn: () => undefined, error: () => undefined });

const trace = (
  flows: TraceFlow[],
  request: Partial<TraceRequest> = {},
  options: Partial<TraceOptions> = {},
  entities: Partial<TraceEntities> = {},
): Promise<Trace> => computeTrace(
  { flows, listeners: LISTENERS, services: SERVICES, hosts: [SERVER], ...entities },
  { hostname: 'app.homelab.example', port: null, client: 'public', ...request },
  { resolvers: RESOLVERS, read: {} as FlowReader, logger: silent, ...options },
);

/** `source → target role[ depth][ cycle] (hop entities)` per step, in walk order. */
const summary = ({ steps }: Trace) => steps.map(({ source, target, role, depth, cycle, hops }) =>
  `${nameOf(source)} → ${nameOf(target)} ${role}${depth > 0 ? ` ${String(depth)}` : ''}${cycle ? ' cycle' : ''}`
  + (hops.length > 0 ? ` (${hops.map(({ entity }) => entity).join(', ')})` : ''));

const nodesOf = ({ nodes }: Trace) => nodes.map(({ id: nodeId }) => nameOf(nodeId));

const APP_NAME = ['app.homelab.example'];

describe('computeTrace: the walk', () => {
  it('given a public A record, a port forward and a proxy route, traces client → proxy listener (DNS and forward hops) → app listener (route hop)', async () => {
    const result = await trace([
      entry(NPM_443, APP_NAME, [forward(FORWARD_443), dns]),
      route(ROUTE_APP, APP_3000, APP_NAME),
    ]);

    expect(summary(result)).toEqual([
      'client → npm:443 request (dns-record, port-forward)',
      'npm:443 → app:3000 request (route)',
    ]);
    expect(result).toMatchObject({ hostname: 'app.homelab.example', port: null, client: 'public', truncated: false });
    expect(result.nodes).toEqual([
      { id: 'client', type: 'client' },
      {
        id: NPM_443.id,
        type: 'listener',
        listener: {
          id: NPM_443.id, port: 443, transport: 'tcp', protocol: null, publishedPort: 443, serviceId: NPM.id,
          serviceName: 'NPM', hostId: SERVER.id, hostName: 'Home server',
        },
      },
      {
        id: APP_3000.id,
        type: 'listener',
        listener: {
          id: APP_3000.id, port: 3000, transport: 'tcp', protocol: null, publishedPort: null, serviceId: APP.id,
          serviceName: 'App', hostId: SERVER.id, hostName: 'Home server',
        },
      },
    ]);
    const [first] = result.steps;
    expect(first?.id).toBe(`${result.steps[0]?.flow.id ?? ''}:client`);
    expect(first?.flow).toEqual({
      id: first?.flow.id, origin: 'derived', extension: 'core', deriver: 'dns', protocol: null, encrypted: null, purpose: null,
    });
  });

  it('given only public records, traced from internal, gives the client alone', async () => {
    const result = await trace([entry(NPM_443, APP_NAME, [dns]), route(ROUTE_APP, APP_3000, APP_NAME)], { client: 'internal' });

    expect(nodesOf(result)).toEqual(['client']);
    expect(result.steps).toEqual([]);
  });

  it('given entries on ports 80 and 443 and no port, keeps both entries and reaches the app listener once, followed once', async () => {
    const result = await trace([
      entry(NPM_80, APP_NAME, [dns, forward(FORWARD_80)]),
      entry(NPM_443, APP_NAME, [dns, forward(FORWARD_443)]),
      route(ROUTE_APP, APP_3000, APP_NAME),
      manual(APP, DB_5432),
    ]);

    expect(summary(result)).toEqual([
      'client → npm:80 request (dns-record, port-forward)',
      'client → npm:443 request (dns-record, port-forward)',
      'npm:80 → app:3000 request (route)',
      'npm:443 → app:3000 request (route)',
      'app:3000 → db:5432 dependency 1',
    ]);
    expect(nodesOf(result)).toEqual(['client', 'npm:80', 'npm:443', 'app:3000', 'db:5432']);
    expect(new Set(result.steps.map((step) => step.id)).size).toBe(result.steps.length);
  });

  it('given entries on ports 80 and 443, with port 443 keeps only that entry, and with port 8080 gives the client alone', async () => {
    const flows = [
      entry(NPM_80, APP_NAME, [dns, forward(FORWARD_80)]),
      entry(NPM_443, APP_NAME, [dns, forward(FORWARD_443)]),
      route(ROUTE_APP, APP_3000, APP_NAME),
    ];
    // Without a forward, the entry port is the listener's published port.
    const internal = [entry(NPM_80, APP_NAME, [dns], 'internal'), entry(NPM_443, APP_NAME, [dns], 'internal')];

    expect(summary(await trace(flows, { port: 443 }))).toEqual([
      'client → npm:443 request (dns-record, port-forward)',
      'npm:443 → app:3000 request (route)',
    ]);
    expect(nodesOf(await trace(flows, { port: 8080 }))).toEqual(['client']);
    expect(summary(await trace(internal, { port: 443, client: 'internal' }))).toEqual(['client → npm:443 request (dns-record)']);
  });

  it('given a forward from external 8443 to a listener on 443, keeps that entry with port 8443 and not with 443', async () => {
    const flows = [entry(NPM_443, APP_NAME, [dns, forward(FORWARD_8443)])];

    expect(summary(await trace(flows, { port: 8443 }))).toEqual(['client → npm:443 request (dns-record, port-forward)']);
    expect(nodesOf(await trace(flows, { port: 443 }))).toEqual(['client']);
  });

  it('given an exact and a wildcard entry, uses only the exact one; a lone wildcard matches deeper names but not its own base', async () => {
    const both = [entry(NPM_443, APP_NAME, [dns]), entry(NPM_80, ['*.homelab.example'], [dns])];
    const wildcard = [entry(NPM_80, ['*.dev.homelab.example'], [dns])];

    expect(summary(await trace(both))).toEqual(['client → npm:443 request (dns-record)']);
    expect(summary(await trace(wildcard, { hostname: 'a.b.dev.homelab.example' })))
      .toEqual(['client → npm:80 request (dns-record)']);
    expect(nodesOf(await trace(wildcard, { hostname: 'dev.homelab.example' }))).toEqual(['client']);
  });

  it('given a proxy with routes for two names, follows only the traced name\'s route', async () => {
    const result = await trace([
      entry(NPM_443, ['app.homelab.example', 'blog.homelab.example'], [dns]),
      route(ROUTE_APP, APP_3000, APP_NAME),
      route(ROUTE_BLOG, BLOG_3000, ['blog.homelab.example']),
    ]);

    expect(summary(result)).toEqual([
      'client → npm:443 request (dns-record)',
      'npm:443 → app:3000 request (route)',
    ]);
  });

  it('given an app with manual flows, gives them as dependencies at depth 1 and follows the dependencies\' own flows at depth 2', async () => {
    const result = await trace([
      entry(NPM_443, APP_NAME, [dns]),
      route(ROUTE_APP, APP_3000, APP_NAME),
      manual(APP, DB_5432),
      manual(APP, API_443),
      manual(DB, BACKUP_9000),
    ]);

    expect(summary(result)).toEqual([
      'client → npm:443 request (dns-record)',
      'npm:443 → app:3000 request (route)',
      'app:3000 → db:5432 dependency 1',
      'app:3000 → api:443 dependency 1',
      'db:5432 → backup:9000 dependency 2',
    ]);
    expect(result.steps.at(2)?.flow).toMatchObject({ origin: 'manual', extension: null, deriver: null });
  });

  it('given a dependency chain longer than 8, stops at depth 8', async () => {
    const chain = Array.from({ length: 11 }, (_, n) => ({ id: id(200 + n), name: `Service ${String(n)}`, hostId: null }));
    const listeners = chain.map((service, n) => listener(300 + n, service, 8000 + n, null));
    const flows = [
      entry(listeners[0] ?? NPM_80, APP_NAME, [dns]),
      ...chain.slice(0, -1).map((service, n) => manual(service, listeners[n + 1] ?? NPM_80)),
    ];

    const result = await trace(flows, {}, {}, { listeners, services: chain });

    expect(result.steps.map(({ depth }) => depth)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.truncated).toBe(false);
  });

  it('given a manual flow back to a service on the path, keeps the step marked as a cycle and does not follow it', async () => {
    const result = await trace([
      entry(NPM_443, APP_NAME, [dns]),
      route(ROUTE_APP, APP_3000, APP_NAME),
      manual(APP, DB_5432),
      manual(DB, APP_3000),
    ]);

    expect(summary(result)).toEqual([
      'client → npm:443 request (dns-record)',
      'npm:443 → app:3000 request (route)',
      'app:3000 → db:5432 dependency 1',
      'db:5432 → app:3000 dependency 2 cycle',
    ]);
  });

  it('given a proxy route to the listener the request arrived at, skips that step', async () => {
    const admin = ['npm.homelab.example'];
    const result = await trace([
      entry(NPM_443, admin, [dns], 'internal'),
      entry(NPM_81, admin, [dns], 'internal'),
      route(ROUTE_ADMIN, NPM_81, admin),
    ], { hostname: 'npm.homelab.example', client: 'internal' });

    expect(summary(result)).toEqual([
      'client → npm:443 request (dns-record)',
      'client → npm:81 request (dns-record)',
      'npm:443 → npm:81 request (route)',
    ]);
  });

  it('given a walk over 500 nodes or 1,000 steps, stops and marks the trace truncated', async () => {
    const many = Array.from({ length: MAX_TRACE_NODES + 100 }, (_, n) => ({ id: id(1000 + n), name: `S${String(n)}`, hostId: null }));
    const listeners = [APP_3000, ...many.map((service, n) => listener(5000 + n, service, 9000, null))];
    const wide = [entry(APP_3000, APP_NAME, [dns]), ...listeners.slice(1).map((target) => manual(APP, target))];
    const repeated = [
      entry(APP_3000, APP_NAME, [dns]),
      ...Array.from({ length: MAX_TRACE_STEPS + 100 }, () => manual(APP, DB_5432)),
    ];

    const byNodes = await trace(wide, {}, {}, { listeners, services: [APP, ...many] });
    const bySteps = await trace(repeated);

    expect(byNodes.truncated).toBe(true);
    expect(byNodes.nodes.length).toBeLessThanOrEqual(MAX_TRACE_NODES);
    expect(bySteps.truncated).toBe(true);
    expect(bySteps.steps).toHaveLength(MAX_TRACE_STEPS);
    expect((await trace([entry(APP_3000, APP_NAME, [dns])])).truncated).toBe(false);
  });
});

describe('computeTrace: hops', () => {
  it('given a basis entity no active extension resolves, gives a generic hop naming the entity', async () => {
    const peer = { entity: 'vpn-peer', id: id(60) };

    const result = await trace([entry(NPM_443, APP_NAME, [dns, peer])]);

    expect(result.steps[0]?.hops).toEqual([
      { entity: 'dns-record', id: RECORD, stage: 'dns', label: 'test.dns-record', params: {} },
      { entity: 'vpn-peer', id: id(60), stage: 'network', label: 'trace.hop.unknown', params: { entity: 'vpn-peer' } },
    ]);
  });

  it('given a resolver that throws, times out or returns an invalid result, gives generic hops, returns the trace and logs the failure with its extension', async () => {
    const failing = (resolve: () => Promise<readonly TraceHop[]>): RegisteredTraceHopResolver =>
      ({ extension: 'nat', resolver: { entity: 'port-forward', resolve } });
    const generic = {
      entity: 'port-forward', id: FORWARD_443, stage: 'network', label: 'trace.hop.unknown', params: { entity: 'port-forward' },
    };
    const flows = [entry(NPM_443, APP_NAME, [forward(FORWARD_443)])];

    for (const resolve of [
      () => Promise.reject(new Error('boom')),
      () => new Promise<never>(() => undefined),
      () => Promise.resolve([{ entity: 'port-forward', id: FORWARD_443, stage: 'tunnel' }] as unknown as TraceHop[]),
    ]) {
      const error = vi.fn();
      const logger = vi.fn((): ExtensionLogger => ({ info: () => undefined, warn: () => undefined, error }));

      const result = await trace(flows, {}, { resolvers: [failing(resolve)], logger, timeoutMs: 20 });

      expect(result.steps[0]?.hops).toEqual([generic]);
      expect(logger).toHaveBeenCalledWith('nat');
      expect(error).toHaveBeenCalledOnce();
    }
  });

  it('given a resolver returning hops for entities it was not given, leaves them out and warns with its extension', async () => {
    const warn = vi.fn();
    const logger = (): ExtensionLogger => ({ info: () => undefined, warn, error: () => undefined });
    const extra: RegisteredTraceHopResolver = {
      extension: 'nat',
      resolver: {
        entity: 'port-forward',
        resolve: ({ ids }) => Promise.resolve([...ids, FORWARD_80].map((hopId): TraceHop =>
          ({ entity: 'port-forward', id: hopId, stage: 'network', label: 'test.port-forward', params: {} }))),
      },
    };

    const result = await trace([entry(NPM_443, APP_NAME, [forward(FORWARD_443)])], {}, { resolvers: [extra], logger });

    expect(result.steps[0]?.hops.map(({ id: hopId }) => hopId)).toEqual([FORWARD_443]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('given a basis with a forward and DNS records, orders the DNS hops before the forward', async () => {
    const second = { entity: 'dns-record', id: id(21) };

    const result = await trace([entry(NPM_443, APP_NAME, [forward(FORWARD_443), dns, second])]);

    expect(result.steps[0]?.hops.map(({ entity, id: hopId }) => `${entity} ${hopId}`)).toEqual([
      `dns-record ${RECORD}`, `dns-record ${id(21)}`, `port-forward ${FORWARD_443}`,
    ]);
  });
});
