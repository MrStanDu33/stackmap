import { createApp, createRouter, toWebHandler } from 'h3';
import { describe, expect, it } from 'vitest';

import handler from './traffic.get';
import { DIALECTS } from '../../../../tests/support/databases';
import { useSignedIn } from '../../../../tests/support/sessions';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { seedDemoStack } from '../../../demo/demo-stack';
import { setDatabase } from '../../../utils/database';
import { setExtensionRegistry } from '../../../utils/extensions';

import type { Traffic } from '../../../../shared/contracts/traffic';
import type { Dialect } from '../../../../tests/support/databases';
import type { Database } from '../../../database/types/schema';
import type { SeededDemoStack } from '../../../demo/demo-stack';
import type { Kysely } from 'kysely';

useSignedIn();

const get = async (workspaceId: string) => {
  const app = createApp().use(createRouter().get('/api/workspaces/:workspaceId/traffic', handler));
  const response = await toWebHandler(app)(new Request(`http://localhost/api/workspaces/${workspaceId}/traffic`));
  return { status: response.status, json: await response.json() as unknown };
};

/** `source → target (deriver)` per flow, sorted, with the demo's names. */
const summary = (traffic: Traffic, seeded: SeededDemoStack) => {
  const names = new Map<string, string>([
    ...Object.entries(seeded.services).map(([name, { id }]): [string, string] => [id, name]),
    ...Object.entries(seeded.listeners).map(([name, { id }]): [string, string] => [id, name]),
  ]);
  const nameOf = (id: string) => names.get(id) ?? id;
  return traffic.flows.map(({ source, targetListenerId, deriver }) =>
    `${source.type === 'client' ? source.client : nameOf(source.serviceId)} → ${nameOf(targetListenerId)}`
    + ` (${deriver ?? 'manual'})`).sort();
};

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/traffic on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  const seed = async () => {
    setDatabase(Promise.resolve(workspaces.db as unknown as Kysely<Database>));
    setExtensionRegistry(BUILTIN_REGISTRY);
    return seedDemoStack(workspaces.a.repos);
  };

  it('returns the demo stack\'s hosts, services, listeners and flows', async () => {
    const seeded = await seed();

    const { status, json } = await get(workspaces.a.workspace.id);

    expect(status).toBe(200);
    const traffic = json as Traffic;
    expect(traffic.truncated).toBe(false);
    expect(traffic.hosts.map(({ name }) => name)).toEqual(['Edge router', 'Home server']);
    expect(traffic.services.map(({ name, hostId }) => [name, hostId])).toEqual([
      ['Nginx Proxy Manager', seeded.hosts.server?.id],
      ['Weather API', null],
      ['Website', seeded.hosts.server?.id],
      ['Website database', seeded.hosts.server?.id],
    ]);
    expect(traffic.listeners).toHaveLength(Object.keys(seeded.listeners).length);
    expect(summary(traffic, seeded)).toEqual([
      'internal → npmAdmin (dns)',
      'internal → npmHttp (dns)',
      'internal → npmHttps (dns)',
      'npm → npmAdmin (routes)',
      'npm → website (routes)',
      'public → npmHttp (port-forwards)',
      'public → npmHttps (port-forwards)',
      'website → database (manual)',
      'website → weatherApi (manual)',
    ]);
    expect(traffic.flows.find(({ targetListenerId }) => targetListenerId === seeded.listeners.database?.id))
      .toMatchObject({ origin: 'manual', purpose: 'Stores the site content' });
  });

  it('returns none of another workspace\'s entities or flows', async () => {
    await seed();

    const { status, json } = await get(workspaces.b.workspace.id);

    expect(status).toBe(200);
    expect(json).toEqual({ hosts: [], services: [], listeners: [], flows: [], truncated: false });
  });

  it('given two seeded workspaces, each one\'s traffic has only its own ids', async () => {
    await seed();
    await seedDemoStack(workspaces.b.repos);
    const idsOf = async (workspaceId: string) => {
      const traffic = (await get(workspaceId)).json as Traffic;
      return new Set([traffic.hosts, traffic.services, traffic.listeners, traffic.flows].flat().map(({ id }) => id));
    };

    const [a, b] = [await idsOf(workspaces.a.workspace.id), await idsOf(workspaces.b.workspace.id)];

    expect(a.size).toBeGreaterThan(0);
    expect(b.size).toBe(a.size);
    expect([...a].filter((id) => b.has(id))).toEqual([]);
  });

  it('answers 404 workspace_not_found for an unknown workspace and 400 validation_failed for a malformed id', async () => {
    await seed();

    expect(await get('0199d6a0-0000-7000-8000-000000000999'))
      .toMatchObject({ status: 404, json: { code: 'workspace_not_found', status: 404 } });
    expect(await get('not-an-id'))
      .toMatchObject({ status: 400, json: { code: 'validation_failed', issues: [{ path: 'params.workspaceId' }] } });
  });

  it('sends no undeclared field', async () => {
    await seed();

    const { json } = await get(workspaces.a.workspace.id);

    const traffic = json as Traffic;
    expect(Object.keys(traffic).sort()).toEqual(['flows', 'hosts', 'listeners', 'services', 'truncated']);
    expect(Object.keys(traffic.hosts[0] ?? {}).sort()).toEqual(['id', 'kind', 'name']);
    expect(Object.keys(traffic.services[0] ?? {}).sort()).toEqual(['hostId', 'id', 'kind', 'name']);
    expect(Object.keys(traffic.listeners[0] ?? {}).sort())
      .toEqual(['id', 'port', 'protocol', 'publishedPort', 'serviceId', 'transport']);
    expect(Object.keys(traffic.flows[0] ?? {}).sort()).toEqual([
      'deriver', 'encrypted', 'extension', 'hostnameCount', 'hostnames', 'id', 'origin', 'protocol', 'purpose',
      'source', 'targetListenerId',
    ]);
  });
});
