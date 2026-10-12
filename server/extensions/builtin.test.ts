import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { checkExtension } from '@stackmap/extension-sdk/testing';
import { describe, expect, it } from 'vitest';

import { BUILTIN_EXTENSIONS } from './builtin';
import { createExtensionRegistry } from './registry';

import type { Messages } from '@stackmap/extension-sdk/testing';

const ROOT = join(import.meta.dirname, '../..');
const EXTENSIONS_DIR = join(ROOT, 'extensions');

const packages = readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

/** Every file under a directory, relative to it. */
const filesUnder = (dir: string): string[] => (existsSync(dir)
  ? readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
  : []);

const localesOf = (id: string) => {
  const dir = join(EXTENSIONS_DIR, id, 'i18n/locales');
  return Object.fromEntries(readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [file.replace(/\.json$/, ''), readJson(join(dir, file)) as Messages]));
};

describe('built-in extensions', () => {
  // tests/unit/extensions/layers.test.ts checks that nuxt.config.ts extends each one as a Nuxt layer.
  it('lists every package of extensions/', () => {
    expect(packages).toContain('core');
    expect(BUILTIN_EXTENSIONS.map(({ id }) => id).sort()).toEqual(packages);
  });

  it.each(packages)('each passes checkExtension with its en.json and fr.json (%s)', (id) => {
    const manifest = BUILTIN_EXTENSIONS.find((extension) => extension.id === id);

    expect(manifest).toBeDefined();
    expect(checkExtension(manifest!, {
      messages: localesOf(id),
      publicFiles: filesUnder(join(EXTENSIONS_DIR, id, 'public')),
    })).toEqual([]);
  });

  it.each(packages)('each has the version of its package.json (%s)', (id) => {
    const { version } = readJson(join(EXTENSIONS_DIR, id, 'package.json')) as { version: string };

    expect(BUILTIN_EXTENSIONS.find((extension) => extension.id === id)?.version).toBe(version);
  });

  it('form a valid registry in which core is always on', () => {
    const registry = createExtensionRegistry(BUILTIN_EXTENSIONS);

    expect(registry.get('core')?.alwaysOn).toBe(true);
  });
});
