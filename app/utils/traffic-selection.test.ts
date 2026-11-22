import { describe, expect, it } from 'vitest';

import { parseTrafficSelected, relatedFlowIds, trafficDrawn } from './traffic-selection';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../tests/support/demo-traffic';

const { hosts, services, listeners, flows } = DEMO_IDS;

const related = (type: 'client' | 'host' | 'service' | 'listener' | 'flow', id: string) =>
  [...relatedFlowIds(DEMO_TRAFFIC, { type, id })].sort();

describe('relatedFlowIds', () => {
  it('given a selected service, highlights its incoming and outgoing flows and no other', () => {
    expect(related('service', services.website)).toEqual(
      [flows.routeWebsite, flows.database, flows.weatherApi].sort(),
    );
    expect(related('service', services.npm)).toEqual([
      flows.internalHttp, flows.internalAdmin, flows.internalHttps, flows.publicHttp, flows.publicHttps,
      flows.routeWebsite, flows.routeAdmin,
    ].sort());
  });

  it('given a selected host, highlights all its services\' flows; a port, the flows ending on it; a flow, only itself', () => {
    expect(related('host', hosts.server)).toEqual(DEMO_TRAFFIC.flows.map(({ id }) => id).sort());
    expect(related('host', hosts.router)).toEqual([]);
    expect(related('listener', listeners.npmAdmin)).toEqual([flows.internalAdmin, flows.routeAdmin].sort());
    expect(related('flow', flows.database)).toEqual([flows.database]);
    expect(related('client', 'public')).toEqual([flows.publicHttp, flows.publicHttps].sort());
    expect(related('service', 'not-in-the-traffic')).toEqual([]);
  });
});

describe('parseTrafficSelected', () => {
  it('reads host:, service:, listener:, flow: and client: values that the traffic draws (9)', () => {
    expect(parseTrafficSelected(`host:${hosts.server}`, DEMO_TRAFFIC)).toEqual({ type: 'host', id: hosts.server });
    expect(parseTrafficSelected(`service:${services.website}`, DEMO_TRAFFIC)).toEqual({ type: 'service', id: services.website });
    expect(parseTrafficSelected(`listener:${listeners.npmAdmin}`, DEMO_TRAFFIC))
      .toEqual({ type: 'listener', id: listeners.npmAdmin });
    expect(parseTrafficSelected(`flow:${flows.database}`, DEMO_TRAFFIC)).toEqual({ type: 'flow', id: flows.database });
    expect(parseTrafficSelected('client:public', DEMO_TRAFFIC)).toEqual({ type: 'client', id: 'public' });
  });

  it('given an unknown id, a bad type, a value without a colon or garbage, gives nothing (9)', () => {
    for (const raw of [
      'host:gone', `service:${hosts.server}`, `step:${hosts.server}`, 'client:elsewhere', `host${hosts.server}`, ':', '',
      undefined, [`host:${hosts.server}`], 42,
    ]) {
      expect(parseTrafficSelected(raw, DEMO_TRAFFIC), String(raw)).toBeNull();
    }
  });
});

describe('trafficDrawn', () => {
  it('maps each drawn host, service and listener id to its ?selected= value (9)', () => {
    const drawn = trafficDrawn(DEMO_TRAFFIC);

    expect(drawn[hosts.server]).toBe(`host:${hosts.server}`);
    expect(drawn[services.website]).toBe(`service:${services.website}`);
    expect(drawn[listeners.npmAdmin]).toBe(`listener:${listeners.npmAdmin}`);
    const { hosts: all, services: running, listeners: ports } = DEMO_TRAFFIC;
    expect(Object.keys(drawn)).toHaveLength(all.length + running.length + ports.length);
  });
});
