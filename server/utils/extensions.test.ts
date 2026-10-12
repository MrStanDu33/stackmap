import { describe, expect, it, vi } from 'vitest';

describe('useExtensionRegistry', () => {
  it('before the plugin ran, fails with a clear error', async () => {
    // A fresh module: the registry is module state, set once by the startup plugin.
    vi.resetModules();
    const { useExtensionRegistry } = await import('./extensions');

    expect(() => useExtensionRegistry()).toThrow(/not ready.*plugin/i);
  });
});
