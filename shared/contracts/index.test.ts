import { readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CONTRACTS } from './index';

import type { Contract } from './contract';

/** Files of shared/contracts/ that define contracts (not the helpers, the list or the tests). */
const CONTRACT_FILE = /^(?!contract\.|index\.|openapi\.|errors\.)[a-z0-9-]+\.ts$/;

const isContract = (value: unknown): value is Contract =>
  typeof value === 'object' && value !== null && 'operationId' in value && 'responses' in value;

describe('contract list', () => {
  it('lists every contract of shared/contracts/', async () => {
    const files = readdirSync(import.meta.dirname).filter((file) => CONTRACT_FILE.test(file));
    const modules = await Promise.all(files.map((file) => import(`./${file}`) as Promise<Record<string, unknown>>));
    const defined = modules.flatMap((module) => Object.values(module).filter(isContract));

    expect(defined.length).toBeGreaterThan(0);
    expect(new Set(CONTRACTS)).toEqual(new Set(defined));
  });

  it('has unique operation IDs', () => {
    const ids = CONTRACTS.map(({ operationId }) => operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique method and path pairs', () => {
    const routes = CONTRACTS.map(({ method, path }) => `${method} ${path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
