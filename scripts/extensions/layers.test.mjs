import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findExtensionLayers } from './layers.mjs';

let root;

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Creates `extensions/<name>/` under a temporary root, with the given files. */
const extension = (name, files) => {
  const dir = join(root, 'extensions', name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), '');
  }
};

describe('findExtensionLayers', () => {
  it('lists the directories of extensions/ that have a nuxt.config.ts, by name', () => {
    root = mkdtempSync(join(tmpdir(), 'stackmap-layers-'));
    extension('vpn', ['nuxt.config.ts', 'manifest.ts']);
    extension('core', ['nuxt.config.ts']);

    expect(findExtensionLayers(root)).toEqual(['./extensions/core', './extensions/vpn']);
  });

  it('skips hidden directories and leftovers without a nuxt.config.ts (such as node_modules after a branch switch)', () => {
    root = mkdtempSync(join(tmpdir(), 'stackmap-layers-'));
    extension('core', ['nuxt.config.ts']);
    extension('.cache', ['nuxt.config.ts']);
    extension('removed', ['node_modules/.modules.yaml']);
    writeFileSync(join(root, 'extensions', 'AGENTS.md'), '');

    expect(findExtensionLayers(root)).toEqual(['./extensions/core']);
  });
});
