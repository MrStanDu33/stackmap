import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import { indexTraffic, originLabel, portLabel, selectionName, traceLinks } from './traffic-index';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../tests/support/demo-traffic';

const { t } = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en, fr } }).global;
const { hosts, services, listeners, flows } = DEMO_IDS;
const ids = (items: readonly { id: string }[]) => items.map(({ id }) => id);

describe('indexTraffic', () => {
  it('looks up what the list and the panel show: services by host, ports by service, flows in and out', () => {
    const index = indexTraffic(DEMO_TRAFFIC);

    expect(ids(index.servicesOf(hosts.server))).toEqual([services.npm, services.website, services.database]);
    expect(ids(index.servicesOf(null))).toEqual([services.weatherApi]);
    expect(ids(index.servicesOf(hosts.router))).toEqual([]);
    expect(ids(index.portsOf(services.npm))).toEqual([listeners.npmHttp, listeners.npmAdmin, listeners.npmHttps]);
    expect(ids(index.flowsInto(listeners.npmAdmin))).toEqual([flows.internalAdmin, flows.routeAdmin]);
    expect(ids(index.flowsFrom({ type: 'service', id: services.website }))).toEqual([flows.database, flows.weatherApi]);
    expect(ids(index.flowsFrom({ type: 'client', id: 'public' }))).toEqual([flows.publicHttp, flows.publicHttps]);
    expect(index.serviceOfPort(listeners.website)?.name).toBe('Website');
    expect(index.host(hosts.server)?.name).toBe('Home server');
  });

  it('names a flow\'s source, port and origin', () => {
    const index = indexTraffic(DEMO_TRAFFIC);
    const flow = (id: string) => {
      const found = DEMO_TRAFFIC.flows.find((item) => item.id === id);
      if (!found) {
        throw new Error(`No flow ${id}`);
      }
      return found;
    };

    expect(index.sourceName(flow(flows.publicHttps), t)).toBe('Internet');
    expect(index.sourceName(flow(flows.database), t)).toBe('Website');
    expect(DEMO_TRAFFIC.listeners.map(portLabel)).toContain('80/tcp');
    expect(originLabel(flow(flows.publicHttps), t)).toBe('Derived by nat (port-forwards)');
    expect(originLabel(flow(flows.database), t)).toBe('Documented by hand');
  });

  it('names a selection: a client, host, service, port or flow, or nothing when it is gone', () => {
    const index = indexTraffic(DEMO_TRAFFIC);

    expect(selectionName(index, { type: 'client', id: 'internal' }, t)).toBe('Local network');
    expect(selectionName(index, { type: 'host', id: hosts.server }, t)).toBe('Home server');
    expect(selectionName(index, { type: 'service', id: services.database }, t)).toBe('Website database');
    expect(selectionName(index, { type: 'listener', id: listeners.npmHttps }, t)).toBe('Nginx Proxy Manager 443/tcp');
    // Written out, not with an arrow that screen readers read as "right arrow".
    expect(selectionName(index, { type: 'flow', id: flows.routeWebsite }, t))
      .toBe('From Nginx Proxy Manager to Website 3000/tcp');
    expect(selectionName(index, { type: 'service', id: 'gone' }, t)).toBeUndefined();
  });
});

const flowOf = (id: string) => {
  const found = DEMO_TRAFFIC.flows.find((item) => item.id === id);
  if (!found) {
    throw new Error(`No flow ${id}`);
  }
  return found;
};
const SITE = ['app.homelab.example', 'homelab.example', 'www.homelab.example'];

describe('traceLinks', () => {
  it('gives one link per exact name and client, sorted by name then client, the Internet first', () => {
    expect(traceLinks([flowOf(flows.internalHttps), flowOf(flows.publicHttps), flowOf(flows.publicHttp)])).toEqual([
      ...SITE.map((hostname) => ({ hostname, client: 'public' })).slice(0, 2),
      { hostname: 'npm.homelab.example', client: 'internal' },
      { hostname: 'www.homelab.example', client: 'public' },
    ]);
    const both = { ...flowOf(flows.internalHttps), hostnames: ['app.homelab.example'] };
    expect(traceLinks([both, flowOf(flows.publicHttps)]).slice(0, 2)).toEqual([
      { hostname: 'app.homelab.example', client: 'public' },
      { hostname: 'app.homelab.example', client: 'internal' },
    ]);
  });

  it('traces a flow from a client from that client, and a flow between services from the Internet', () => {
    expect(traceLinks([flowOf(flows.internalAdmin)])).toEqual([{ hostname: 'npm.homelab.example', client: 'internal' }]);
    expect(traceLinks([flowOf(flows.routeAdmin)])).toEqual([{ hostname: 'npm.homelab.example', client: 'public' }]);
  });

  it('leaves out wildcards and the names cut from the list', () => {
    const flow = { ...flowOf(flows.publicHttps), hostnames: ['*.homelab.example', 'app.homelab.example'], hostnameCount: 40 };

    expect(traceLinks([flow])).toEqual([{ hostname: 'app.homelab.example', client: 'public' }]);
    expect(traceLinks([flowOf(flows.database)])).toEqual([]);
  });
});

describe('namesReaching', () => {
  const index = indexTraffic(DEMO_TRAFFIC);

  it('given a port, gives the trace links of the named flows into it, without duplicates', () => {
    expect(index.namesReaching({ type: 'listener', id: listeners.npmHttps })).toEqual([
      { hostname: 'app.homelab.example', client: 'public' },
      { hostname: 'homelab.example', client: 'public' },
      { hostname: 'npm.homelab.example', client: 'internal' },
      { hostname: 'www.homelab.example', client: 'public' },
    ]);
    // Through the proxy: a flow between services, traced from the Internet.
    expect(index.namesReaching({ type: 'listener', id: listeners.website })).toEqual(
      SITE.map((hostname) => ({ hostname, client: 'public' })),
    );
  });

  it('given a service, gives the trace links of the named flows into any of its ports', () => {
    expect(index.namesReaching({ type: 'service', id: services.npm })).toEqual([
      { hostname: 'app.homelab.example', client: 'public' },
      { hostname: 'homelab.example', client: 'public' },
      { hostname: 'npm.homelab.example', client: 'public' },
      { hostname: 'npm.homelab.example', client: 'internal' },
      { hostname: 'www.homelab.example', client: 'public' },
    ]);
  });

  it('given a port or service no named flow reaches, gives none', () => {
    expect(index.namesReaching({ type: 'service', id: services.database })).toEqual([]);
    expect(index.namesReaching({ type: 'listener', id: listeners.database })).toEqual([]);
    expect(index.namesReaching({ type: 'host', id: hosts.server })).toEqual([]);
  });
});
