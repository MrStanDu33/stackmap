import { globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { expect, it } from 'vitest';
import { z } from 'zod';

import type { ExtensionServer } from '@stackmap/extension-sdk';

/** The object under an entity's input schema, through the refine's transform. */
const shapeOf = (schema: z.ZodType): Record<string, z.ZodType> => {
  const object = schema instanceof z.ZodPipe ? schema.in : schema;
  if (!(object instanceof z.ZodObject)) {
    throw new Error('An entity input schema is an object, or an object piped into a refine.');
  }
  return object.shape;
};

/** The source of each call to one of `names` (`addIssue(`, `.refine(`), up to its closing parenthesis. */
export function callsTo(source: string, names: readonly string[]): string[] {
  const calls: string[] = [];
  for (const name of names) {
    for (let start = source.indexOf(name); start !== -1; start = source.indexOf(name, start + 1)) {
      let depth = 0;
      let end = start + name.length - 1;
      do {
        const char = source[end];
        depth += char === '(' ? 1 : char === ')' ? -1 : 0;
        end += 1;
      } while (depth > 0 && end < source.length);
      calls.push(source.slice(start, end));
    }
  }
  return calls;
}

/**
 * Checks an extension's entity schemas as API documentation: every field described with examples, and every custom
 * issue of its entity sources (`entitiesDirs`) carrying a stable code in `params.code`.
 */
export function itDocumentsEntities(server: ExtensionServer, entitiesDirs: readonly string[], criteria = '(2, 26)'): void {
  it(`describes every field with a description and examples ${criteria}`, () => {
    const undocumented = (server.repositories ?? []).flatMap(({ entity, schema }) =>
      Object.entries(shapeOf(schema.input)).flatMap(([field, fieldSchema]) => {
        const meta = fieldSchema.meta() as { description?: string; examples?: unknown[] } | undefined;
        return meta?.description?.trim() && (meta.examples?.length ?? 0) > 0 ? [] : [`${entity}.${field}`];
      }));

    expect(undocumented).toEqual([]);
  });

  it(`gives every custom issue a stable code ${criteria}`, () => {
    const files = entitiesDirs.flatMap((dir) => globSync(join(dir, '*.ts'))).filter((file) => !file.endsWith('.test.ts'));
    const uncoded = files.flatMap((file) => callsTo(readFileSync(file, 'utf8'), ['addIssue(', '.refine(', '.superRefine('])
      .filter((call) => !/params:\s*\{\s*code:\s*'[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*'/.test(call))
      .map((call) => `${relative(process.cwd(), file)}: ${call.slice(0, 80)}`));

    expect(files.length).toBeGreaterThan(0);
    expect(uncoded).toEqual([]);
  });
}
