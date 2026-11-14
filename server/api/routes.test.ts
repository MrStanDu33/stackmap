import { globSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { createApp, createRouter, toWebHandler } from 'h3';
import { afterEach, describe, expect, it } from 'vitest';

import { CONTRACTS } from '../../shared/contracts';
import { WORKSPACE_ROLES } from '../../shared/contracts/contract';
import { NO_PREFERENCES } from '../../shared/contracts/preferences';
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

/** The contract a route implements, or the contracts of a generic route (the entity API: one per entity type). */
const contractsOf = async (file: string): Promise<readonly Contract[]> => {
  type Route = { default: { contract?: Contract; contracts?: readonly Contract[] } };
  const { contract, contracts } = (await import(file) as Route).default;
  return contract ? [contract] : contracts ?? [];
};

/** Whether a contract's path is served by a route: equal, or with the route's `:extension/:entity` filled in. */
const serves = (route: { method: string; path: string }, contract: Contract) => {
  const pattern = new RegExp(`^${route.path.replace(':extension/:entity', '[a-z0-9-]+/[a-z0-9-]+')}$`);
  return contract.method === route.method && (contract.path === route.path || pattern.test(contract.path));
};

describe('API routes and contracts', () => {
  it('every route file uses a contract whose method and path match its Nitro route', async () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    const mismatches = [];
    for (const file of routeFiles) {
      const contracts = await contractsOf(file);
      const route = routeOf(file);
      if (contracts.length === 0) {
        mismatches.push(`${relative(API_DIR, file)}: route ${route.method} ${route.path}, contract missing`);
      }
      for (const contract of contracts.filter((candidate) => !serves(route, candidate))) {
        mismatches.push(`${relative(API_DIR, file)}: route ${route.method} ${route.path}, `
          + `contract ${contract.method} ${contract.path}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every contract has a route file', () => {
    const routes = routeFiles.map(routeOf);
    const orphans = CONTRACTS.filter((contract) => !routes.some((route) => serves(route, contract)))
      .map(({ method, path }) => `${method} ${path}`);
    expect(orphans).toEqual([]);
  });

  afterEach(() => {
    setSessionResolver(() => Promise.resolve(null));
  });

  it('every route enforces its contract\'s role: 401 without a session, 403 for instanceAdmin ones below it (20)', async () => {
    const wrong = [];
    for (const file of routeFiles) {
      const handler = (await import(file) as { default: Parameters<ReturnType<typeof createRouter>['use']>[1] }).default;
      const route = routeOf(file);
      for (const contract of await contractsOf(file)) {
        if (contract.requiredRole === 'public') {
          continue;
        }
        // Every placeholder filled, so the route matches; the role is checked before the input.
        const path = contract.path.replaceAll(/:\w+/g, '0199d6a0-0000-7000-8000-000000000001');
        const call = async () => {
          const app = createApp().use(createRouter().use(route.path, handler, contract.method));
          return (await toWebHandler(app)(new Request(`http://localhost${path}`, { method: contract.method.toUpperCase() }))).status;
        };
        setSessionResolver(() => Promise.resolve(null));
        const signedOut = await call();
        setSessionResolver(() => Promise.resolve({
          user: {
            id: '0199d6a0-0000-7000-8000-000000000102', name: 'Grace', email: 'grace@homelab.example', role: 'user',
            mustChangePassword: false, preferences: NO_PREFERENCES,
          },
        }));
        // Workspace roles need a membership, in the database: server/utils/contract-handler.integration.test.ts.
        const asUser = contract.requiredRole === 'instanceAdmin' ? await call() : 403;
        if (signedOut !== 401 || asUser !== 403) {
          wrong.push(`${contract.operationId}: ${String(signedOut)} signed out, ${String(asUser)} as a user`);
        }
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

describe('accounts', () => {
  it('creates no account from an invitation link: whoever holds one could claim its email (security review of 4c)', () => {
    expect(CONTRACTS.filter(({ path }) => path.startsWith('/api/invitations/')).map(({ method, path }) => `${method} ${path}`).sort())
      .toEqual(['get /api/invitations/:token', 'post /api/invitations/:token/accept']);
  });
});
