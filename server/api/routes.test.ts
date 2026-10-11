import { globSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTRACTS } from '../../shared/contracts';

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
});
