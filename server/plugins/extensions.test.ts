import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExtensionManifest } from '@stackmap/extension-sdk';

/** Runs the plugin with fresh modules, so it builds a new registry. */
const runPlugin = async () => {
  vi.resetModules();
  vi.stubGlobal('defineNitroPlugin', (plugin: unknown) => plugin);
  const { default: plugin } = await import('./extensions');
  plugin({} as Parameters<typeof plugin>[0]);
  return import('../utils/extensions');
};

afterEach(() => {
  vi.doUnmock('../extensions/builtin');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extensions plugin', () => {
  it('at startup, builds the registry from the built-in extensions, which useExtensionRegistry() returns', async () => {
    const { useExtensionRegistry } = await runPlugin();
    const { BUILTIN_EXTENSIONS } = await import('../extensions/builtin');

    expect(useExtensionRegistry().extensions.map(({ id }) => id))
      .toEqual(expect.arrayContaining(BUILTIN_EXTENSIONS.map(({ id }) => id)));
    expect(useExtensionRegistry().get('core')?.alwaysOn).toBe(true);
  });

  it('given an invalid registry, logs every problem and exits', async () => {
    const vpn = { id: 'vpn', apiVersion: 1, dependsOn: ['tls'], contributes: { kinds: {} } } as unknown as ExtensionManifest;
    vi.doMock('../extensions/builtin', () => ({ BUILTIN_EXTENSIONS: [vpn, vpn] }));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await runPlugin();

    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/\[extensions\][\s\S]*installed twice[\s\S]*not installed/));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
