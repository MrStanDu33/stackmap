import { readdirSync } from 'node:fs';

import { defineExtensionServer } from '@stackmap/extension-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { version } from '../../package.json';

import type { ExtensionManifest, ExtensionServer } from '@stackmap/extension-sdk';

type Hook = () => Promise<void> | void;

const manifest = (id: string, { alwaysOn = false, dependsOn = [] as string[], apiVersion = 1 } = {}) => ({
  id,
  version: '1.0.0',
  apiVersion,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn,
  dependsOn,
  code: { server: true },
  contributes: { kinds: {} },
}) satisfies ExtensionManifest;

/** Just enough of Nitro's app for the plugin: it registers hooks by name. */
const fakeNitroApp = () => {
  const hooks = new Map<string, Hook[]>();
  return {
    app: { hooks: { hook: (name: string, hook: Hook) => hooks.set(name, [...(hooks.get(name) ?? []), hook]) } },
    run: async (name: string) => {
      for (const hook of hooks.get(name) ?? []) {
        await hook();
      }
    },
  };
};

/**
 * Runs the plugin with fresh modules and the given built-in extensions (the real ones by default), with a database
 * that is ready when `database` resolves.
 */
const runPlugin = async (
  builtin?: { manifests: ExtensionManifest[]; servers: ExtensionServer[] },
  database: Promise<unknown> = Promise.resolve({}),
  migrateExtensions: () => Promise<void> = () => Promise.resolve(),
) => {
  vi.resetModules();
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin);
  vi.doMock('../utils/database', () => ({ useDatabase: () => database }));
  // The extension migrations have their own integration tests; here they only need to run at the right time.
  vi.doMock('../extensions/migrations', () => ({ migrateExtensions }));
  if (builtin) {
    vi.doMock('../extensions/builtin', () => ({
      BUILTIN_EXTENSIONS: builtin.manifests,
      BUILTIN_EXTENSION_SERVERS: builtin.servers,
    }));
  }
  const { default: plugin } = await import('./00.extensions');
  const nitro = fakeNitroApp();
  plugin(nitro.app as unknown as Parameters<typeof plugin>[0]);
  const { useExtensionRegistry } = await import('../utils/extensions');
  return { nitro, useExtensionRegistry };
};

afterEach(() => {
  vi.doUnmock('../extensions/migrations');
  vi.doUnmock('../extensions/builtin');
  vi.doUnmock('../utils/database');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extensions plugin', () => {
  it('at startup, builds the registry from the built-in extensions, which useExtensionRegistry() returns', async () => {
    const { nitro, useExtensionRegistry } = await runPlugin();
    await nitro.run('request');
    const { BUILTIN_EXTENSIONS } = await import('../extensions/builtin');

    expect(useExtensionRegistry().active.map(({ id }) => id))
      .toEqual(expect.arrayContaining(BUILTIN_EXTENSIONS.map(({ id }) => id)));
    expect(useExtensionRegistry().get('core')).toMatchObject({ state: 'active', manifest: { alwaysOn: true } });
  });

  it('given a failed always-on extension, logs every problem and exits', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await runPlugin({
      manifests: [manifest('core', { alwaysOn: true, apiVersion: 99 }), manifest('vpn', { dependsOn: ['tls'] })],
      servers: [],
    });

    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/\[extensions\][\s\S]*"core" targets[\s\S]*not installed/));
    expect(exit).toHaveBeenCalledWith(1);
  });
});

describe('extensions plugin: lifecycle', () => {
  it('runs the extension migrations once the database is ready, before the extensions\' setup and before requests', async () => {
    const order: string[] = [];
    let databaseReady: (db: unknown) => void = () => undefined;
    const database = new Promise((resolve) => {
      databaseReady = resolve;
    });
    const tls = manifest('tls');
    const { nitro } = await runPlugin(
      { manifests: [tls], servers: [defineExtensionServer(tls, { setup: () => void order.push('setup') })] },
      database,
      () => {
        order.push('migrations');
        return Promise.resolve();
      },
    );
    const request = nitro.run('request').then(() => void order.push('request'));
    await Promise.resolve();
    expect(order).toEqual([]);

    databaseReady({});
    await request;

    expect(order).toEqual(['migrations', 'setup', 'request']);
  });

  it('runs each active extension setup once, in registry order, after the registry is built', async () => {
    const order: string[] = [];
    const tls = manifest('tls');
    const proxy = manifest('proxy', { dependsOn: ['tls'] });
    const { nitro } = await runPlugin({
      manifests: [proxy, tls],
      servers: [
        defineExtensionServer(proxy, { setup: () => void order.push('proxy') }),
        defineExtensionServer(tls, { setup: () => void order.push('tls') }),
      ],
    });

    await nitro.run('request');
    await nitro.run('request');

    expect(order).toEqual(['tls', 'proxy']);
  });

  it('given a setup that throws, marks the extension and its dependents failed and keeps starting', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const tls = manifest('tls');
    const proxy = manifest('proxy', { dependsOn: ['tls'] });
    const { nitro, useExtensionRegistry } = await runPlugin({
      manifests: [tls, proxy],
      servers: [
        defineExtensionServer(tls, {
          setup: () => {
            throw new Error('certificate store unreachable');
          },
        }),
        defineExtensionServer(proxy, {}),
      ],
    });

    await nitro.run('request');

    expect(useExtensionRegistry().get('tls')).toMatchObject({
      state: 'failed',
      errors: [expect.stringMatching(/setup failed: certificate store unreachable/)],
    });
    expect(useExtensionRegistry().get('proxy')?.state).toBe('failed');
    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/\[extension:tls\].*certificate store unreachable/));
    expect(exit).not.toHaveBeenCalled();
  });

  it('calls app:ready with the app version once the database is migrated', async () => {
    const ready = vi.fn();
    const { promise: database, resolve: migrate } = Promise.withResolvers();
    const vpn = manifest('vpn');
    const { nitro } = await runPlugin(
      { manifests: [vpn], servers: [defineExtensionServer(vpn, { hooks: { 'app:ready': ready } })] },
      database,
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ready).not.toHaveBeenCalled();

    migrate({});
    await nitro.run('request');
    expect(ready).toHaveBeenCalledWith({ version });
  });

  it('lets requests wait for the extensions\' setup, not for their app:ready handlers', async () => {
    const vpn = manifest('vpn');
    const { nitro } = await runPlugin({
      manifests: [vpn],
      servers: [defineExtensionServer(vpn, { hooks: { 'app:ready': () => new Promise(() => undefined) } })],
    });

    await expect(nitro.run('request')).resolves.toBeUndefined();
  });

  it('calls app:close before the database closes', async () => {
    const closed = vi.fn();
    const vpn = manifest('vpn');
    const { nitro } = await runPlugin({
      manifests: [vpn],
      servers: [defineExtensionServer(vpn, { hooks: { 'app:close': closed } })],
    });

    await nitro.run('close');

    expect(closed).toHaveBeenCalledWith({});
    // Nitro runs plugins, and their close hooks, in file name order (as it sorts them): this one before the database.
    const plugins = readdirSync(import.meta.dirname).filter((file) => !file.includes('.test.'));
    expect(plugins.sort((a, b) => a.localeCompare(b)).indexOf('00.extensions.ts'))
      .toBeLessThan(plugins.indexOf('database.ts'));
  });
});
