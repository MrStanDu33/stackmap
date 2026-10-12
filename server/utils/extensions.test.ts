import { describe, expect, it, vi } from 'vitest';

import type { ExtensionRuntime } from '../extensions/runtime';

// A fresh module per test: the registry and the runtime are module state, set once by the startup plugin.
const loadModule = async () => {
  vi.resetModules();
  return import('./extensions');
};

describe('useExtensionRegistry', () => {
  it('before the plugin ran, fails with a clear error', async () => {
    const { useExtensionRegistry, useExtensionHooks } = await loadModule();

    expect(() => useExtensionRegistry()).toThrow(/not ready.*plugin/i);
    expect(() => useExtensionHooks()).toThrow(/not ready.*plugin/i);
  });
});

describe('useExtensionHooks', () => {
  it('calls hooks on the extensions once they have started', async () => {
    const { setExtensionRuntime, useExtensionHooks } = await loadModule();
    const callHook = vi.fn(() => Promise.resolve());
    const { promise, resolve } = Promise.withResolvers<ExtensionRuntime>();
    setExtensionRuntime(promise);

    const call = useExtensionHooks().callHook('app:ready', { version: '1.0.0' });
    expect(callHook).not.toHaveBeenCalled();
    resolve({ callHook, handlersOf: () => [] });
    await call;

    expect(callHook).toHaveBeenCalledWith('app:ready', { version: '1.0.0' });
  });
});
