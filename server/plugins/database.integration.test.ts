import { afterEach, describe, expect, it, vi } from 'vitest';

import { MIGRATIONS } from '../database/migrations';

type Hook = () => Promise<void> | void;

/** Just enough of Nitro's app for the plugin: it registers hooks by name. */
const fakeNitroApp = () => {
  const hooks = new Map<string, Hook>();
  return {
    app: { hooks: { hook: (name: string, hook: Hook) => hooks.set(name, hook) } },
    run: async (name: string) => {
      await hooks.get(name)?.();
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('database plugin', () => {
  it('makes requests wait until the database is migrated, then closes it with the app', async () => {
    vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin);
    vi.stubEnv('DATABASE_URL', ':memory:');
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { default: plugin } = await import('./database');
    const nitro = fakeNitroApp();

    plugin(nitro.app as unknown as Parameters<typeof plugin>[0]);
    await nitro.run('request');

    expect(info).toHaveBeenCalledWith(
      expect.stringContaining(`Applied database migrations: ${Object.keys(MIGRATIONS).join(', ')}`),
    );
    await nitro.run('close');
  });
});
