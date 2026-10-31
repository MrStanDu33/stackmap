import { describe, expect, it } from 'vitest';

import { relatedFlowIds } from './traffic-selection';
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
