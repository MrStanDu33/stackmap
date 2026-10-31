import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './trace.get';
import { DIALECTS } from '../../../../tests/support/databases';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { seedDemoStack } from '../../../demo/demo-stack';
import { setDatabase } from '../../../utils/database';
import { setExtensionRegistry } from '../../../utils/extensions';

import type { Trace } from '../../../../shared/contracts/traces';
import type { Dialect } from '../../../../tests/support/databases';
import type { Database } from '../../../database/types/schema';
import type { SeededDemoStack } from '../../../demo/demo-stack';
import type { Kysely } from 'kysely';

const get = async (workspaceId: string, query: string) => {
  const app = createApp().use(createRouter().get('/api/workspaces/:workspaceId/trace', handler));
  const response = await toWebHandler(app)(
    new Request(`http://localhost/api/workspaces/${workspaceId}/trace?${query}`),
  );
  return { status: response.status, json: await response.json() as unknown };
};

/** `source → target role[ depth][ cycle] (hop entities)` per step, sorted, with the demo's listener names. */
const summary = (trace: Trace, seeded: SeededDemoStack) => {
  const names = new Map<string, string>([
    ['client', 'client'],
    ...Object.entries(seeded.listeners).map(([name, { id }]): [string, string] => [id, name]),
  ]);
  const nameOf = (id: string) => names.get(id) ?? id;
  return trace.steps.map(({ source, target, role, depth, cycle, hops }) =>
    `${nameOf(source)} → ${nameOf(target)} ${role}${depth > 0 ? ` ${String(depth)}` : ''}${cycle ? ' cycle' : ''}`
    + (hops.length > 0 ? ` (${hops.map(({ entity }) => entity).join(', ')})` : '')).sort();
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/trace on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);

  const seed = async () => {
    setDatabase(Promise.resolve(workspaces.db as unknown as Kysely<Database>));
    setExtensionRegistry(BUILTIN_REGISTRY);
    return seedDemoStack(workspaces.a.repos);
  };

  it('given the demo workspace and app.homelab.example, returns 200 with the public trace: NPM 80 and 443, the website, then the database and the weather API', async () => {
    const seeded = await seed();

    const { status, json } = await get(workspaces.a.workspace.id, 'hostname=app.homelab.example');

    expect(status).toBe(200);
    expect(json).toMatchObject({ hostname: 'app.homelab.example', port: null, client: 'public', truncated: false });
    expect(summary(json as Trace, seeded)).toEqual([
      'client → npmHttp request (dns-record, port-forward)',
      'client → npmHttps request (dns-record, port-forward)',
      'npmHttp → website request (route)',
      'npmHttps → website request (route)',
      'website → database dependency 1',
      'website → weatherApi dependency 1',
    ]);
  });

  it('given client internal and npm.homelab.example, returns NPM 80, 443 and 81 and the routes to NPM 81, with no cycle', async () => {
    const seeded = await seed();

    const { status, json } = await get(workspaces.a.workspace.id, 'hostname=npm.homelab.example&client=internal');

    expect(status).toBe(200);
    expect(summary(json as Trace, seeded)).toEqual([
      'client → npmAdmin request (dns-record)',
      'client → npmHttp request (dns-record)',
      'client → npmHttps request (dns-record)',
      'npmHttp → npmAdmin request (route)',
      'npmHttps → npmAdmin request (route)',
    ]);
  });

  it('given a missing or invalid hostname, a port outside 1–65535 or an unknown client, returns 400 validation_failed naming the query field; normalizes an upper-case hostname', async () => {
    await seed();
    const workspaceId = workspaces.a.workspace.id;
    const issuesOf = async (query: string) => {
      const { status, json } = await get(workspaceId, query);
      expect(status).toBe(400);
      expect(json).toMatchObject({ code: 'validation_failed' });
      // A value can break several rules (too long and not a hostname): each field is named once.
      return [...new Set((json as { issues: { path: string }[] }).issues.map(({ path }) => path))];
    };

    expect(await issuesOf('')).toEqual(['query.hostname']);
    expect(await issuesOf('hostname=*.homelab.example')).toEqual(['query.hostname']);
    expect(await issuesOf(`hostname=${'a'.repeat(250)}.example`)).toEqual(['query.hostname']);
    expect(await issuesOf('hostname=bad_label.example')).toEqual(['query.hostname']);
    expect(await issuesOf('hostname=app.homelab.example&port=0')).toEqual(['query.port']);
    expect(await issuesOf('hostname=app.homelab.example&port=70000')).toEqual(['query.port']);
    expect(await issuesOf('hostname=app.homelab.example&client=vpn')).toEqual(['query.client']);
    expect(await get(workspaceId, 'hostname=APP.Homelab.Example&port=443'))
      .toMatchObject({ status: 200, json: { hostname: 'app.homelab.example', port: 443 } });
  });

  it('given an unknown workspace, returns 404 workspace_not_found', async () => {
    await seed();

    expect(await get('0199d6a0-0000-7000-8000-000000000999', 'hostname=app.homelab.example'))
      .toMatchObject({ status: 404, json: { code: 'workspace_not_found', status: 404 } });
    expect(await get('not-an-id', 'hostname=app.homelab.example'))
      .toMatchObject({ status: 400, json: { code: 'validation_failed', issues: [{ path: 'params.workspaceId' }] } });
  });
});
