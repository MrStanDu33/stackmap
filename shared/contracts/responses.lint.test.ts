import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CONTRACTS } from './index';
import { JsonValue } from './system';

/** Schema types that accept any value, so the response parsing cannot strip what is under them. */
const LOOSE_TYPES = new Set(['any', 'unknown', 'custom']);

const isSchema = (value: unknown): value is z.ZodType =>
  typeof value === 'object' && value !== null && '_zod' in value;

/**
 * The paths of the loose parts of a schema: `z.unknown()`, `z.any()`, `z.custom()`, and objects that keep undeclared
 * keys (passthrough, loose or catchall). Walks every schema the definition holds, so wrappers, unions, records and
 * lazy schemas are covered without listing them.
 */
function loosePaths(schema: z.ZodType, path = '', seen = new Set<z.ZodType>()): string[] {
  if (seen.has(schema)) return [];
  seen.add(schema);
  const def = schema._zod.def as unknown as Record<string, unknown> & { type: string };
  if (LOOSE_TYPES.has(def.type)) return [path || '(root)'];
  const found: string[] = [];
  if (def.type === 'object' && isSchema(def.catchall) && def.catchall._zod.def.type !== 'never') {
    found.push(`${path || '(root)'} (undeclared keys kept)`);
  }
  const visit = (value: unknown, at: string): void => {
    if (isSchema(value)) found.push(...loosePaths(value, at, seen));
    else if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) visit(item, `${at}[${String(index)}]`);
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) visit(item, `${at}.${key}`);
    }
  };
  for (const [key, value] of Object.entries(def)) {
    if (key === 'catchall') continue;
    if (key === 'getter' && typeof value === 'function') visit((value as () => unknown)(), path);
    else visit(value, key === 'shape' ? path : `${path}<${key}>`);
  }
  return found;
}

describe('response schemas: strict enough to strip undeclared fields', () => {
  it.each([
    ['z.unknown()', z.object({ data: z.unknown() })],
    ['z.any()', z.array(z.any())],
    ['z.custom()', z.object({ data: z.custom<string>() }).optional()],
    ['a passthrough object', z.object({ id: z.string() }).loose()],
    ['a loose object', z.looseObject({ id: z.string() })],
    ['a catchall object', z.object({ id: z.string() }).catchall(z.string())],
    ['a record of unknown values', z.record(z.string(), z.unknown())],
    ['a lazy loose schema', z.lazy(() => z.unknown())],
  ])('finds %s', (_, schema) => {
    expect(loosePaths(schema)).not.toEqual([]);
  });

  it('accepts strict schemas, including the recursive JSON value made of typed leaves', () => {
    expect(loosePaths(z.object({ id: z.string(), tags: z.array(z.string()).optional() }))).toEqual([]);
    expect(loosePaths(z.strictObject({ id: z.string() }))).toEqual([]);
    expect(loosePaths(JsonValue)).toEqual([]);
  });

  it('has no loose part in any contract response', () => {
    const loose = CONTRACTS.flatMap(({ operationId, responses }) => Object.entries(responses)
      .flatMap(([status, { schema }]) => loosePaths(schema).map((at) => `${operationId} ${status}: ${at}`)));
    expect(loose).toEqual([]);
  });
});
