import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';

import { elkToVueFlow, trafficToElk } from './traffic-graph';
import en from '../../i18n/locales/en.json';
import fr from '../../i18n/locales/fr.json';
import { DEMO_IDS, DEMO_TRAFFIC } from '../../tests/support/demo-traffic';

import type { ElkNode } from 'elkjs/lib/elk-api';

const { t } = createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en, fr } }).global;
const { hosts, services, listeners, flows } = DEMO_IDS;

/** The ELK graph with every node placed: what the layout worker returns, without running ELK. */
const placed = (node: ElkNode, offset = 10): ElkNode => ({
  ...node,
  x: offset,
  y: offset,
  children: node.children?.map((child, index) => placed(child, offset + index * 10)),
});

const childIds = (node: ElkNode | undefined) => node?.children?.map(({ id }) => id) ?? [];

describe('trafficToElk', () => {
  it('given the demo traffic, makes hosts compound nodes holding their services, ports of the service nodes ordered by port, clients only when a flow starts from them, the external service top-level, and every flow an edge to its target port', () => {
    const graph = trafficToElk(DEMO_TRAFFIC);
    const node = (id: string) => graph.children?.find((child) => child.id === id);
    const server = node(`host:${hosts.server}`);
    const npm = server?.children?.find(({ id }) => id === `service:${services.npm}`);

    expect(childIds(graph).sort()).toEqual([
      'client:internal', 'client:public', `host:${hosts.router}`, `host:${hosts.server}`,
      `service:${services.weatherApi}`,
    ].sort());
    expect(childIds(server).sort()).toEqual([
      `service:${services.npm}`, `service:${services.website}`, `service:${services.database}`,
    ].sort());
    expect(childIds(node(`host:${hosts.router}`))).toEqual([]);
    expect(npm?.ports?.map(({ id }) => id)).toEqual([
      `listener:${listeners.npmHttp}`, `listener:${listeners.npmAdmin}`, `listener:${listeners.npmHttps}`,
    ]);
    expect(graph.edges?.map(({ id, sources, targets }) => [id, sources, targets])).toContainEqual(
      [`flow:${flows.publicHttps}`, ['client:public'], [`listener:${listeners.npmHttps}`]],
    );
    expect(graph.edges?.map(({ id, sources, targets }) => [id, sources, targets])).toContainEqual(
      [`flow:${flows.weatherApi}`, [`service:${services.website}`], [`listener:${listeners.weatherApi}`]],
    );
    expect(graph.edges).toHaveLength(DEMO_TRAFFIC.flows.length);
    for (const child of [...(graph.children ?? []), ...(server?.children ?? [])]) {
      expect(child.width, child.id).toBeGreaterThan(0);
      expect(child.height, child.id).toBeGreaterThan(0);
    }
  });

  it('given an empty traffic, makes an ELK graph with no node', () => {
    const graph = trafficToElk({ hosts: [], services: [], listeners: [], flows: [], truncated: false });

    expect(graph.children).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});

describe('elkToVueFlow', () => {
  it('gives children their parent and relative positions, edges their target port handle, and every node and edge an accessible name', () => {
    const layout = placed(trafficToElk(DEMO_TRAFFIC));

    const { nodes, edges } = elkToVueFlow(DEMO_TRAFFIC, layout, t);
    const node = (id: string) => nodes.find((item) => item.id === id);
    const npm = node(`service:${services.npm}`);

    expect(npm).toMatchObject({
      type: 'service',
      parentNode: `host:${hosts.server}`,
      ariaLabel: 'Nginx Proxy Manager, reverse-proxy, on Home server, 3 ports',
    });
    expect(npm?.position).toEqual({ x: expect.any(Number) as unknown, y: expect.any(Number) as unknown });
    // A parent comes before its children, as Vue Flow requires.
    expect(nodes.findIndex(({ id }) => id === `host:${hosts.server}`))
      .toBeLessThan(nodes.findIndex(({ id }) => id === `service:${services.npm}`));
    expect(node(`service:${services.weatherApi}`)).toMatchObject({
      parentNode: undefined, ariaLabel: 'Weather API, external-api, external, 1 port',
    });
    expect(node(`host:${hosts.server}`)?.ariaLabel).toBe('Home server, physical, 3 services');
    expect(node('client:public')?.ariaLabel).toBe('Internet');
    expect(edges.find(({ id }) => id === `flow:${flows.publicHttps}`)).toMatchObject({
      source: 'client:public',
      target: `service:${services.npm}`,
      targetHandle: `listener:${listeners.npmHttps}`,
      ariaLabel: 'From Internet to Nginx Proxy Manager, port 443/tcp',
    });
    expect(edges.find(({ id }) => id === `flow:${flows.database}`)?.ariaLabel)
      .toBe('From Website to Website database, port 5432/tcp');
    expect(edges).toHaveLength(DEMO_TRAFFIC.flows.length);
  });
});
