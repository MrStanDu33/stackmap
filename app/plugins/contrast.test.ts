import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { Ref } from 'vue';

type HtmlAttrs = Record<string, () => string | undefined>;

/** Runs the plugin with the contrast cookie set to `cookie`; returns the `<html>` attributes it asks for. */
const start = async (cookie: string | undefined) => {
  const state = new Map<string, Ref>();
  const useHead = vi.fn<(head: { htmlAttrs: HtmlAttrs }) => void>();
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin);
  vi.stubGlobal('useCookie', () => ref(cookie));
  vi.stubGlobal('useState', (key: string, init: () => unknown) => {
    if (!state.has(key)) {
      state.set(key, ref(init()));
    }
    return state.get(key);
  });
  vi.stubGlobal('useHead', useHead);
  const { default: plugin } = await import('./contrast');
  (plugin as () => void)();
  const attrs = useHead.mock.calls[0]?.[0].htmlAttrs ?? {};
  return { contrast: () => attrs['data-contrast']?.(), state: state.get('stackmap:contrast') };
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('contrast plugin', () => {
  it('applies the strict contrast from its cookie to <html>, from the first render, and follows changes', async () => {
    const { contrast, state } = await start('strict');

    expect(contrast()).toBe('strict');
    if (state) {
      state.value = 'standard';
    }
    expect(contrast()).toBeUndefined();
  });

  it('leaves the standard contrast without an attribute, whatever else the cookie holds', async () => {
    expect((await start(undefined)).contrast()).toBeUndefined();
    vi.resetModules();
    expect((await start('<script>')).contrast()).toBeUndefined();
  });
});
