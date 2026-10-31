import { defineExtensionClient } from '@stackmap/extension-sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClientHooks, ExtensionClient, ExtensionManifest } from '@stackmap/extension-sdk';

type Hook = (...args: unknown[]) => unknown;

const manifest = (id: string): ExtensionManifest => ({
  id,
  version: '1.0.0',
  apiVersion: 1,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn: false,
  dependsOn: [],
  code: { client: true },
  contributes: { kinds: {} },
});

const client = (id: string, hooks: Parameters<typeof defineExtensionClient>[1]['hooks']) =>
  defineExtensionClient(manifest(id), { hooks });

/** Just enough of the Nuxt app: hooks by name and the current route. */
const fakeNuxtApp = () => {
  const hooks = new Map<string, Hook[]>();
  const route = { path: '/' };
  return {
    app: {
      hook: (name: string, hook: Hook) => hooks.set(name, [...(hooks.get(name) ?? []), hook]),
      $router: { currentRoute: { value: route } },
    },
    route,
    run: async (name: string, ...args: unknown[]) => {
      for (const hook of hooks.get(name) ?? []) {
        await hook(...args);
      }
    },
  };
};

/** Runs the plugin with the given clients; the server reports the given extension states. */
const runPlugin = async (
  clients: ExtensionClient[],
  states: Record<string, 'active' | 'failed'>,
  list: () => Promise<unknown> = () => Promise.resolve({
    extensions: Object.entries(states).map(([id, state]) => ({ id, state })),
  }),
) => {
  vi.resetModules();
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin);
  vi.stubGlobal('$fetch', vi.fn(list));
  vi.doMock('../extensions/builtin', () => ({ BUILTIN_EXTENSION_CLIENTS: clients }));
  const { default: plugin } = await import('./extensions.client');
  const nuxt = fakeNuxtApp();
  await (plugin as unknown as (app: unknown) => Promise<void>)(nuxt.app);
  return nuxt;
};

afterEach(() => {
  vi.doUnmock('../extensions/builtin');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extensions client plugin', () => {
  it('calls app:mounted once the app is mounted', async () => {
    const mounted = vi.fn();
    const nuxt = await runPlugin([client('vpn', { 'app:mounted': mounted })], { vpn: 'active' });

    await nuxt.run('app:mounted');

    expect(mounted).toHaveBeenCalledExactlyOnceWith({});
  });

  it('calls route:changed after each navigation, with the path', async () => {
    const changed = vi.fn();
    const nuxt = await runPlugin([client('vpn', { 'route:changed': changed })], { vpn: 'active' });

    nuxt.route.path = '/hosts';
    await nuxt.run('page:finish');
    nuxt.route.path = '/flows';
    await nuxt.run('page:finish');

    expect(changed.mock.calls).toEqual([[{ path: '/hosts' }], [{ path: '/flows' }]]);
  });

  it('calls locale:changed after a language switch, with the locale', async () => {
    const changed = vi.fn<(payload: ClientHooks['locale:changed']) => void>();
    const nuxt = await runPlugin([client('vpn', { 'locale:changed': changed })], { vpn: 'active' });

    await nuxt.run('i18n:localeSwitched', { oldLocale: 'en', newLocale: 'fr' });

    expect(changed).toHaveBeenCalledWith({ locale: 'fr' });
  });

  it('runs handlers of active extensions only, and logs a failing one with its id', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const skipped = vi.fn();
    const after = vi.fn();
    const nuxt = await runPlugin([
      client('broken', {
        'app:mounted': () => {
          throw new Error('boom');
        },
      }),
      client('failed', { 'app:mounted': skipped }),
      client('fine', { 'app:mounted': after }),
    ], { broken: 'active', failed: 'failed', fine: 'active' });

    await nuxt.run('app:mounted');

    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/\[extension:broken\] app:mounted failed/), expect.any(Error));
    expect(skipped).not.toHaveBeenCalled();
    expect(after).toHaveBeenCalled();
  });

  it('with the stackmap:debug flag, traces every hook call', async () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === 'stackmap:debug' ? 'extensions' : null) });
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const nuxt = await runPlugin([client('vpn', { 'app:mounted': () => undefined })], { vpn: 'active' });

    await nuxt.run('app:mounted');

    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^\[extensions\] app:mounted → vpn \(\d/));
  });

  it('given the list cannot be read yet (signed out, 401), asks again at the next hook: once signed in, the handlers run', async () => {
    const mounted = vi.fn();
    const changed = vi.fn();
    // Signed out at start and when mounted; signed in by the first navigation.
    const list = vi.fn()
      .mockRejectedValueOnce(new Error('401 Unauthorized'))
      .mockRejectedValueOnce(new Error('401 Unauthorized'))
      .mockResolvedValueOnce({ extensions: [{ id: 'fine', state: 'active' }] });
    const nuxt = await runPlugin([client('fine', { 'app:mounted': mounted, 'route:changed': changed })], {}, list);

    await nuxt.run('app:mounted');
    await nuxt.run('page:finish');

    expect(mounted).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledOnce();
  });
});
