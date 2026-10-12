import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The built-in extensions to extend as Nuxt layers: directories of extensions/ with a nuxt.config.ts. Hidden
 * directories and leftovers (such as a node_modules left by a branch switch) are skipped: a layer runs code at build
 * time, so only real extension packages become layers.
 *
 * @param {string} root The repository root.
 * @returns {string[]} Layer paths relative to the root (`./extensions/<id>`), by name.
 */
export const findExtensionLayers = (root) => {
  const dir = join(root, 'extensions');
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .filter((entry) => existsSync(join(dir, entry.name, 'nuxt.config.ts')))
    .map((entry) => `./extensions/${entry.name}`)
    .sort();
};
