import { afterEach, describe, expect, it, vi } from 'vitest';

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

const seedDemoWorkspace = vi.fn<(...args: unknown[]) => Promise<void>>();
const whenExtensionsStarted = vi.fn<() => Promise<void>>();
const database = { name: 'database' };
const registry = { name: 'registry' };

vi.mock('../demo/seed-demo-workspace', () => ({ seedDemoWorkspace }));
vi.mock('../utils/database', () => ({ useDatabase: () => Promise.resolve(database) }));
vi.mock('../utils/extensions', () => ({ useExtensionRegistry: () => registry, whenExtensionsStarted }));

const start = async () => {
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin);
  const { default: plugin } = await import('./demo');
  const nitro = fakeNitroApp();
  plugin(nitro.app as unknown as Parameters<typeof plugin>[0]);
  return nitro;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
  seedDemoWorkspace.mockReset();
  whenExtensionsStarted.mockReset();
});

describe('demo plugin', () => {
  it('seeds the demo workspace once the database is ready, and requests wait for it', async () => {
    vi.stubEnv('STACKMAP_DEMO', 'true');
    const extensions = Promise.withResolvers<undefined>();
    const seeding = Promise.withResolvers<undefined>();
    whenExtensionsStarted.mockReturnValue(extensions.promise);
    seedDemoWorkspace.mockReturnValue(seeding.promise);
    const nitro = await start();

    let served = false;
    const request = nitro.run('request').then(() => {
      served = true;
    });
    await Promise.resolve();
    expect(seedDemoWorkspace).not.toHaveBeenCalled();
    extensions.resolve(undefined);
    await vi.waitFor(() => {
      expect(seedDemoWorkspace).toHaveBeenCalledWith(database, expect.objectContaining({
        env: expect.objectContaining({ STACKMAP_DEMO: 'true' }) as unknown,
        registry,
      }));
    });
    expect(served).toBe(false);
    seeding.resolve(undefined);
    await request;
    expect(served).toBe(true);
  });

  it('keeps the app running when the seed fails', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    whenExtensionsStarted.mockResolvedValue(undefined);
    seedDemoWorkspace.mockRejectedValue(new Error('Database gone'));
    const nitro = await start();

    await nitro.run('request');

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Database gone'));
    expect(exit).not.toHaveBeenCalled();
  });
});
