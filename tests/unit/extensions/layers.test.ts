import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('built-in extension layers', () => {
  it('nuxt.config.ts extends every package of extensions/ as a Nuxt layer', async () => {
    const packages = readdirSync(join(import.meta.dirname, '../../../extensions'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config);

    const { default: config } = await import('../../../nuxt.config');

    expect(packages).toContain('core');
    expect(config.extends).toEqual(packages.map((id) => `./extensions/${id}`));
  });
});
