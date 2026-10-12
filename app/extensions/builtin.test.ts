import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUILTIN_EXTENSION_CLIENTS } from './builtin';
import { BUILTIN_EXTENSIONS } from '../../server/extensions/builtin';

const EXTENSIONS_DIR = join(import.meta.dirname, '../../extensions');

const packages = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('built-in extension clients', () => {
  it('lists every extensions/*/client.ts with its manifest', () => {
    const withClientCode = packages.filter((id) => existsSync(join(EXTENSIONS_DIR, id, 'client.ts')));

    expect(BUILTIN_EXTENSION_CLIENTS.map(({ extension }) => extension).sort()).toEqual(withClientCode);
    for (const id of packages) {
      const declared = BUILTIN_EXTENSIONS.find((extension) => extension.id === id)?.code?.client ?? false;
      expect({ id, declared }).toEqual({ id, declared: withClientCode.includes(id) });
    }
  });
});
