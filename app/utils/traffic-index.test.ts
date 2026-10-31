import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import { indexTraffic, originLabel, portLabel, selectionName } from './traffic-index';
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
    expect(selectionName(index, { type: 'flow', id: flows.routeWebsite }, t))
      .toBe('Nginx Proxy Manager → Website 3000/tcp');
    expect(selectionName(index, { type: 'service', id: 'gone' }, t)).toBeUndefined();
  });
});
