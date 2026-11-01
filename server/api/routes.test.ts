import { globSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, describe, expect, it } from 'vitest';

import { CONTRACTS } from '../../shared/contracts';
import { WORKSPACE_ROLES } from '../../shared/contracts/contract';
import { setSessionResolver } from '../utils/session';

import type { Contract } from '../../shared/contracts/contract';

const API_DIR = import.meta.dirname;

/** Nitro's route for a file of server/api/: `things/[id].patch.ts` → `patch /api/things/:id`. */
const routeOf = (file: string) => {
  const match = /^(?<route>.+?)(?:\.(?<method>get|post|put|patch|delete))?\.ts$/.exec(relative(API_DIR, file));
  const route = (match?.groups?.route ?? '')
    .replace(/(^|\/)index$/, '')
    .replace(/\[\.\.\.(\w+)\]/g, '**:$1')
    .replace(/\[(\w+)\]/g, ':$1');
  return { method: match?.groups?.method ?? 'any', path: `/api${route ? `/${route}` : ''}` };
};

const routeFiles = globSync(join(API_DIR, '**/*.ts')).filter((file) => !file.endsWith('.test.ts'));

const contractOf = async (file: string) =>
  ((await import(file) as { default: { contract?: Contract } }).default).contract;

describe('API routes and contracts', () => {
  it('every route file uses a contract whose method and path match its Nitro route', async () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    const mismatches = [];
    for (const file of routeFiles) {
      const contract = await contractOf(file);
      const route = routeOf(file);
      if (contract?.method !== route.method || contract.path !== route.path) {
        mismatches.push(`${relative(API_DIR, file)}: route ${route.method} ${route.path}, `
          + `contract ${contract ? `${contract.method} ${contract.path}` : 'missing'}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every contract has a route file', () => {
    const routes = new Set(routeFiles.map(routeOf).map(({ method, path }) => `${method} ${path}`));
    const orphans = CONTRACTS.map(({ method, path }) => `${method} ${path}`).filter((route) => !routes.has(route));
    expect(orphans).toEqual([]);
  });

  afterEach(() => {
    setSessionResolver(() => Promise.resolve(null));
  });

  it('every route enforces its contract\'s role: 401 without a session, 403 for instanceAdmin ones below it (20)', async () => {
    const wrong = [];
    for (const file of routeFiles) {
      const handler = (await import(file) as { default: Parameters<ReturnType<typeof createRouter>['use']>[1] }).default;
      const contract = await contractOf(file);
      if (!contract || contract.requiredRole === 'public') {
        continue;
      }
      // Every placeholder filled, so the route matches; the role is checked before the input.
      const path = contract.path.replaceAll(/:\w+/g, '0199d6a0-0000-7000-8000-000000000001');
      const call = async () => {
        const app = createApp().use(createRouter().use(contract.path, handler, contract.method));
        return (await toWebHandler(app)(new Request(`http://localhost${path}`, { method: contract.method.toUpperCase() }))).status;
      };
      setSessionResolver(() => Promise.resolve(null));
      const signedOut = await call();
      setSessionResolver(() => Promise.resolve({
        user: { id: '0199d6a0-0000-7000-8000-000000000102', name: 'Grace', email: 'grace@homelab.example', role: 'user' },
      }));
      // Workspace roles need a membership, in the database: server/utils/contract-handler.integration.test.ts.
      const asUser = contract.requiredRole === 'instanceAdmin' ? await call() : 403;
      if (signedOut !== 401 || asUser !== 403) {
        wrong.push(`${contract.operationId}: ${String(signedOut)} signed out, ${String(asUser)} as a user`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('no route answers under /api/auth: Better Auth\'s own router is not mounted (21)', () => {
    expect(routeFiles.map(routeOf).filter(({ path }) => path.startsWith('/api/auth'))).toEqual([]);
    expect(globSync(join(API_DIR, '../routes/**/*.ts'))).toEqual([]);
  });
});

describe('workspace roles', () => {
  it('declares a workspace role only with a workspaceId path parameter, and no route reads params.workspaceId (11)', async () => {
    const workspaceRoles: readonly string[] = WORKSPACE_ROLES;
    const withoutWorkspace = CONTRACTS
      .filter(({ requiredRole, path }) => workspaceRoles.includes(requiredRole) && !path.includes('/:workspaceId'))
      .map(({ operationId }) => operationId);
    expect(withoutWorkspace).toEqual([]);

    // Routes reach the workspace through input.workspace, which only the membership check creates, and build its
    // repositories with workspaceRepositories(), which takes nothing else.
    const readers = [];
    for (const file of routeFiles) {
      const source = await readFile(file, 'utf8');
      if (/params\.workspaceId|params\[['"]workspaceId['"]\]|params:\s*\{[^}]*\bworkspaceId\b|getRouterParams?\(|createWorkspaceRepositories\(/
        .test(source)) {
        readers.push(relative(API_DIR, file));
      }
    }
    expect(readers).toEqual([]);
  });
});
