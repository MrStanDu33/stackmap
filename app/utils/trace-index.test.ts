import { describe, expect, it } from 'vitest';

import { hopSentence, indexTrace } from './trace-index';
import { DEMO_TRACE } from '../../tests/support/demo-trace';
import { DEMO_IDS } from '../../tests/support/demo-traffic';
import { createTestI18n } from '../../tests/support/i18n';

const { global: i18n } = createTestI18n();
const { t } = i18n;
const te = (key: string) => i18n.te(key);
const { listeners, flows } = DEMO_IDS;
const ids = (steps: readonly { id: string }[]) => steps.map(({ id }) => id);

describe('indexTrace', () => {
  it('groups request steps, and dependency steps by depth, and lists the steps into and out of a listener', () => {
    const index = indexTrace(DEMO_TRACE);

    expect(ids(index.request)).toEqual([
      `${flows.publicHttp}:client`, `${flows.publicHttps}:client`,
      `${flows.routeWebsite}:${listeners.npmHttp}`, `${flows.routeWebsite}:${listeners.npmHttps}`,
    ]);
    expect(index.dependencies.map(([depth, steps]) => [depth, ids(steps)])).toEqual([
      [1, [`${flows.database}:${listeners.website}`, `${flows.weatherApi}:${listeners.website}`]],
    ]);
    expect(ids(index.stepsInto(listeners.website))).toEqual([
      `${flows.routeWebsite}:${listeners.npmHttp}`, `${flows.routeWebsite}:${listeners.npmHttps}`,
    ]);
    expect(ids(index.stepsFrom(listeners.website))).toEqual([
      `${flows.database}:${listeners.website}`, `${flows.weatherApi}:${listeners.website}`,
    ]);
    expect(index.listener(listeners.npmHttps)?.serviceName).toBe('Nginx Proxy Manager');
    expect(index.entries).toBe(2);
  });

  it('writes each hop as its translated sentence, a generic hop with its plural, and a missing label as a fallback', () => {
    const [dns, forward] = DEMO_TRACE.steps[1]?.hops ?? [];
    const hop = (label: string, params: Record<string, string>) =>
      ({ entity: 'firewall-rule', id: flows.database, stage: 'network' as const, label, params });

    expect(dns && hopSentence(dns, t, te)).toBe('app.homelab.example resolves to 203.0.113.10 in public DNS');
    expect(forward && hopSentence(forward, t, te)).toBe('Edge router forwards 203.0.113.10:443/tcp to 10.0.10.20:443');
    expect(hopSentence(hop('trace.hop.unknown', { entity: 'firewall-rule', count: '3' }), t, te))
      .toBe('No details available for 3 entries');
    expect(hopSentence(hop('trace.hop.unknown', { entity: 'firewall-rule', count: '1' }), t, te))
      .toBe('No details available');
    expect(hopSentence(hop('extensions.firewall.trace.rule', {}), t, te)).toBe('firewall-rule: no description');
  });
});

describe('walk', () => {
  it('given the demo trace, walks the request steps in order, then the dependency steps by level', () => {
    const deeper = { ...DEMO_TRACE.steps[4], id: 'deeper', depth: 2 };
    const trace = { ...DEMO_TRACE, steps: [deeper, ...DEMO_TRACE.steps] } as typeof DEMO_TRACE;

    expect(ids(indexTrace(trace).walk)).toEqual([
      `${flows.publicHttp}:client`, `${flows.publicHttps}:client`,
      `${flows.routeWebsite}:${listeners.npmHttp}`, `${flows.routeWebsite}:${listeners.npmHttps}`,
      `${flows.database}:${listeners.website}`, `${flows.weatherApi}:${listeners.website}`,
      'deeper',
    ]);
  });

  it('gives a step its position, total, previous and next; none before the first or after the last', () => {
    const index = indexTrace(DEMO_TRACE);
    const [first, second, third] = ids(index.walk);
    const last = ids(index.walk).at(-1) ?? '';

    expect(index.position(second ?? '')).toEqual({ position: 2, total: 6, previous: first, next: third });
    expect(index.position(first ?? '')).toEqual({ position: 1, total: 6, next: second });
    expect(index.position(last)).toMatchObject({ position: 6, total: 6, next: undefined });
    expect(index.position('gone')).toBeUndefined();
  });
});
