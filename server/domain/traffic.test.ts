import { describe, expect, it } from 'vitest';

import { buildTraffic } from './traffic';
import { MAX_TRAFFIC_FLOW_HOSTNAMES, MAX_TRAFFIC_FLOWS, MAX_TRAFFIC_HOSTS } from '../../shared/contracts/traffic';

import type { TraceFlow } from './trace';
import type { TrafficEntities } from './traffic';

const id = (n: number) => `0199d6a0-0000-7000-8000-${String(n).padStart(12, '0')}`;

const ROUTER = { id: id(1), name: 'Edge router', kind: 'router' };
const SERVER = { id: id(2), name: 'Home server', kind: 'physical' };
const NPM = { id: id(3), name: 'NPM', kind: 'reverse-proxy', hostId: SERVER.id };
const APP = { id: id(4), name: 'App', kind: 'app', hostId: SERVER.id };
const API = { id: id(5), name: 'Weather API', kind: 'external-api', hostId: null };

const listener = (n: number, service: { id: string }, port: number) =>
  ({ id: id(n), serviceId: service.id, port, transport: 'tcp', protocol: null, publishedPort: null });

const NPM_443 = listener(10, NPM, 443);
const NPM_80 = listener(11, NPM, 80);
const APP_3000 = listener(12, APP, 3000);
const API_443 = listener(13, API, 443);

let flowSequence = 100;

const flow = (overrides: Partial<TraceFlow> & Pick<TraceFlow, 'targetListenerId'>): TraceFlow => {
  flowSequence += 1;
  return {
    id: id(flowSequence), origin: 'derived', extension: 'core', deriver: 'dns', sourceServiceId: null, sourceClient: null,
    protocol: null, encrypted: null, purpose: null, hostnames: [], basis: [], ...overrides,
  };
};

const manual = (source: { id: string }, target: { id: string }, purpose: string) => flow({
  origin: 'manual', extension: null, deriver: null, sourceServiceId: source.id, targetListenerId: target.id, purpose,
});

const entities = (overrides: Partial<TrafficEntities> = {}): TrafficEntities => ({
  hosts: [SERVER, ROUTER],
  services: [NPM, APP, API],
  listeners: [NPM_443, NPM_80, APP_3000, API_443],
  flows: [],
  ...overrides,
});

describe('buildTraffic', () => {
  it('gives a client entry flow a client source and the hostnames that reach it', () => {
    const entry = flow({
      sourceClient: 'public', targetListenerId: NPM_443.id, hostnames: ['www.homelab.example', 'app.homelab.example'],
    });

    const [built] = buildTraffic(entities({ flows: [entry] })).flows;

    expect(built).toEqual({
      id: entry.id, origin: 'derived', extension: 'core', deriver: 'dns', source: { type: 'client', client: 'public' },
      targetListenerId: NPM_443.id, protocol: null, encrypted: null, purpose: null,
      hostnames: ['app.homelab.example', 'www.homelab.example'], hostnameCount: 2,
    });
  });

  it('gives a manual flow its service source and its purpose', () => {
    const call = manual(APP, API_443, 'Fetches the forecasts');

    const [built] = buildTraffic(entities({ flows: [call] })).flows;

    expect(built).toMatchObject({
      id: call.id, origin: 'manual', extension: null, deriver: null, source: { type: 'service', serviceId: APP.id },
      targetListenerId: API_443.id, purpose: 'Fetches the forecasts', hostnames: [], hostnameCount: 0,
    });
  });

  it('orders hosts and services by name, listeners by service then port, derived flows before manual ones', () => {
    const call = manual(APP, API_443, 'Fetches the forecasts');
    const proxy = flow({ extension: 'reverse-proxy', deriver: 'routes', sourceServiceId: NPM.id, targetListenerId: APP_3000.id });
    const entry = flow({ sourceClient: 'public', targetListenerId: NPM_80.id });

    const traffic = buildTraffic(entities({ flows: [call, proxy, entry] }));

    expect(traffic.hosts.map(({ name }) => name)).toEqual(['Edge router', 'Home server']);
    expect(traffic.services.map(({ name }) => name)).toEqual(['App', 'NPM', 'Weather API']);
    expect(traffic.listeners.map(({ id: listenerId }) => listenerId))
      .toEqual([APP_3000.id, NPM_80.id, NPM_443.id, API_443.id]);
    expect(traffic.flows.map(({ id: flowId }) => flowId)).toEqual([proxy.id, entry.id, call.id]);
  });

  it('returns the first 50 hostnames of a flow, sorted, with hostnameCount the total', () => {
    const names = Array.from({ length: MAX_TRAFFIC_FLOW_HOSTNAMES + 10 }, (_, n) => `site-${String(n).padStart(3, '0')}.homelab.example`);
    const entry = flow({ sourceClient: 'public', targetListenerId: NPM_443.id, hostnames: names.toReversed() });

    const [built] = buildTraffic(entities({ flows: [entry] })).flows;

    expect(built?.hostnames).toEqual(names.slice(0, MAX_TRAFFIC_FLOW_HOSTNAMES));
    expect(built?.hostnameCount).toBe(names.length);
  });

  it('cuts a list at its cap, sets truncated, and leaves out the flows referring to a cut item', () => {
    const hosts = Array.from({ length: MAX_TRAFFIC_HOSTS }, (_, n) => ({ id: id(1000 + n), name: `Host ${String(n).padStart(3, '0')}`, kind: 'vm' }));
    const last = { id: id(9000), name: 'Zz last host', kind: 'vm' };
    const onLast = { id: id(9001), name: 'On the last host', kind: 'app', hostId: last.id };
    const onLastListener = listener(9002, onLast, 8080);
    const toCut = flow({ sourceClient: 'internal', targetListenerId: onLastListener.id });
    const kept = Array.from({ length: MAX_TRAFFIC_FLOWS }, () => flow({ sourceClient: 'public', targetListenerId: NPM_443.id }));
    const beyond = flow({ sourceClient: 'public', targetListenerId: NPM_80.id });

    const traffic = buildTraffic(entities({
      hosts: [last, ...hosts, SERVER],
      services: [NPM, onLast],
      listeners: [NPM_443, NPM_80, onLastListener],
      flows: [toCut, ...kept, beyond],
    }));

    expect(traffic.truncated).toBe(true);
    expect(traffic.hosts).toHaveLength(MAX_TRAFFIC_HOSTS);
    expect(traffic.hosts.map(({ id: hostId }) => hostId)).not.toContain(last.id);
    expect(traffic.services.map(({ id: serviceId }) => serviceId)).toEqual([NPM.id]);
    expect(traffic.listeners.map(({ id: listenerId }) => listenerId)).toEqual([NPM_80.id, NPM_443.id]);
    expect(traffic.flows).toHaveLength(MAX_TRAFFIC_FLOWS);
    expect(traffic.flows.map(({ id: flowId }) => flowId)).not.toContain(toCut.id);
    expect(traffic.flows.map(({ id: flowId }) => flowId)).not.toContain(beyond.id);
  });

  it('leaves out a flow whose service or listener is missing', () => {
    const fromGone = flow({ sourceServiceId: id(77), targetListenerId: APP_3000.id });
    const toGone = flow({ sourceClient: 'public', targetListenerId: id(78) });
    const fine = manual(APP, API_443, 'Fetches the forecasts');

    const traffic = buildTraffic(entities({ flows: [fromGone, toGone, fine] }));

    expect(traffic.flows.map(({ id: flowId }) => flowId)).toEqual([fine.id]);
    expect(traffic.truncated).toBe(false);
  });

  it('returns empty lists and truncated false for an empty workspace', () => {
    expect(buildTraffic({ hosts: [], services: [], listeners: [], flows: [] }))
      .toEqual({ hosts: [], services: [], listeners: [], flows: [], truncated: false });
  });
});
