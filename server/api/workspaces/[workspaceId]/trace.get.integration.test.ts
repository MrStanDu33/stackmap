import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './trace.get';
import { DIALECTS } from '../../../../tests/support/databases';
import { useMemberOf } from '../../../../tests/support/sessions';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../../../tests/support/workspaces';
import { seedDemoStack } from '../../../demo/demo-stack';
import { setExtensionsEnabled } from '../../../repositories/workspace-extensions';
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
  useMemberOf(workspaces);

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

  it('given an unknown workspace or a malformed id, returns 404 workspace_not_found', async () => {
    await seed();

    expect(await get('0199d6a0-0000-7000-8000-000000000999', 'hostname=app.homelab.example'))
      .toMatchObject({ status: 404, json: { code: 'workspace_not_found', status: 404 } });
    // The membership is checked before the input: a malformed id is a workspace the caller cannot open.
    expect(await get('not-an-id', 'hostname=app.homelab.example'))
      .toMatchObject({ status: 404, json: { code: 'workspace_not_found', status: 404 } });
  });
});

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/trace as a member of one workspace on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  useMemberOf(workspaces, { of: ['a'] });

  it('given a member of A only, answers 404 for B and A\'s data for A (12)', async () => {
    setDatabase(Promise.resolve(workspaces.db as unknown as Kysely<Database>));
    setExtensionRegistry(BUILTIN_REGISTRY);
    await seedDemoStack(workspaces.a.repos);
    await seedDemoStack(workspaces.b.repos);

    expect(await get(workspaces.b.workspace.id, 'hostname=app.homelab.example'))
      .toMatchObject({ status: 404, json: { code: 'workspace_not_found' } });
    expect((await get(workspaces.a.workspace.id, 'hostname=app.homelab.example')).status).toBe(200);
  });
});

describe.each(DIALECTS)('GET /api/workspaces/:workspaceId/trace with an extension turned off on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  useMemberOf(workspaces);
  const db = () => workspaces.db as unknown as Kysely<Database>;

  it('given NAT off, traces the same steps with the port forward\'s hop hidden and the DNS hops unchanged (6, 7)', async () => {
    setDatabase(Promise.resolve(db()));
    setExtensionRegistry(BUILTIN_REGISTRY);
    await seedDemoStack(workspaces.a.repos);
    const shown = (await get(workspaces.a.workspace.id, 'hostname=app.homelab.example')).json as Trace;
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);

    const hidden = (await get(workspaces.a.workspace.id, 'hostname=app.homelab.example')).json as Trace;

    const ends = (trace: Trace) => trace.steps.map(({ source, target }) => [source, target]);
    expect(ends(hidden)).toEqual(ends(shown));
    const hops = hidden.steps.flatMap((step) => step.hops);
    const shownHops = shown.steps.flatMap((step) => step.hops);
    expect(hops.filter(({ entity }) => entity === 'port-forward').length).toBeGreaterThan(0);
    for (const hop of hops.filter(({ entity }) => entity === 'port-forward')) {
      const before = shownHops.find(({ id }) => id === hop.id);
      expect(hop).toEqual({
        entity: 'port-forward', id: hop.id, stage: before?.stage, label: 'trace.hop.hidden', params: { extension: 'nat' },
        ...(before?.port === undefined ? {} : { port: before.port }),
      });
    }
    expect(hops.filter(({ entity }) => entity === 'dns-record')).toEqual(shownHops.filter(({ entity }) => entity === 'dns-record'));
  });
});
