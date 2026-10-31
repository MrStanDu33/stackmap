import { describe, expect, it } from 'vitest';

import { traceElkToVueFlow, traceToElk } from './trace-graph';
import { DEMO_TRACE, NOTHING_TRACE } from '../../tests/support/demo-trace';
import { DEMO_IDS } from '../../tests/support/demo-traffic';
import { createTestI18n } from '../../tests/support/i18n';

import type { ElkNode } from 'elkjs/lib/elk-api';

const { t } = createTestI18n().global;
const { listeners, flows } = DEMO_IDS;

const placed = (node: ElkNode): ElkNode => ({ ...node, x: 10, y: 20, children: node.children?.map(placed) });

describe('traceToElk', () => {
  it('given the public trace of app.homelab.example, makes the client and the five listeners nodes and every step an edge; given an empty trace, no edge', () => {
    const graph = traceToElk(DEMO_TRACE);

    expect(graph.children?.map(({ id }) => id).sort()).toEqual([
      'client', ...[listeners.npmHttp, listeners.npmHttps, listeners.website, listeners.database, listeners.weatherApi]
        .map((listenerId) => `listener:${listenerId}`),
    ].sort());
    expect(graph.edges?.map(({ sources, targets }) => [sources[0], targets[0]])).toContainEqual(
      ['client', `listener:${listeners.npmHttps}`],
    );
    expect(graph.edges).toHaveLength(DEMO_TRACE.steps.length);
    for (const child of graph.children ?? []) {
      expect(child.width, child.id).toBeGreaterThan(0);
    }
    expect(traceToElk(NOTHING_TRACE).edges).toEqual([]);
    expect(traceToElk(NOTHING_TRACE).children?.map(({ id }) => id)).toEqual(['client']);
  });
});

describe('traceElkToVueFlow', () => {
  it('gives listeners and steps their accessible names, button roles and translated role descriptions; dashes dependencies and marks cycles', () => {
    const cycle = { ...DEMO_TRACE.steps[2], id: 'cycle', target: listeners.npmHttp, cycle: true };
    const trace = { ...DEMO_TRACE, steps: [...DEMO_TRACE.steps, cycle] } as typeof DEMO_TRACE;

    const { nodes, edges } = traceElkToVueFlow(trace, placed(traceToElk(trace)), t);
    const node = (id: string) => nodes.find((item) => item.id === id);
    const edge = (id: string) => edges.find((item) => item.id === `step:${id}`);

    expect(node(`listener:${listeners.npmHttps}`)).toMatchObject({
      type: 'listener',
      ariaLabel: 'Nginx Proxy Manager, 443/tcp https, on Home server',
      domAttributes: { role: 'button', 'aria-roledescription': 'listener' },
    });
    expect(node(`listener:${listeners.weatherApi}`)?.ariaLabel).toBe('Weather API, 443/tcp https, external');
    expect(node('client')).toMatchObject({
      type: 'client', ariaLabel: 'Internet', domAttributes: { role: 'button', 'aria-roledescription': 'client' },
    });
    expect(edge(`${flows.publicHttps}:client`)).toMatchObject({
      source: 'client',
      target: `listener:${listeners.npmHttps}`,
      ariaLabel: 'From Internet to Nginx Proxy Manager, port 443/tcp',
      domAttributes: { 'aria-roledescription': 'step' },
      data: { kind: 'request' },
    });
    expect(edge(`${flows.database}:${listeners.website}`)).toMatchObject({
      ariaLabel: 'From Website to Website database, port 5432/tcp, dependency, level 1',
      data: { kind: 'dependency' },
    });
    expect(edge('cycle')).toMatchObject({
      ariaLabel: 'From Nginx Proxy Manager to Nginx Proxy Manager, port 80/tcp, back to Nginx Proxy Manager 80/tcp: already followed, the trace stops here',
      data: { kind: 'cycle' },
    });
  });
});
