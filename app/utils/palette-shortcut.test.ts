import { afterEach, describe, expect, it, vi } from 'vitest';

import { isMac, isPaletteShortcut, paletteShortcutLabel } from './palette-shortcut';

const key = (overrides: Partial<KeyboardEvent> = {}) =>
  ({ key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides }) as KeyboardEvent;

describe('isPaletteShortcut', () => {
  it('given Cmd+K on macOS or Ctrl+K elsewhere, says it opens the palette (1)', () => {
    expect(isPaletteShortcut(key({ metaKey: true }), { mac: true })).toBe(true);
    expect(isPaletteShortcut(key({ ctrlKey: true }), { mac: false })).toBe(true);
    expect(isPaletteShortcut(key({ ctrlKey: true, key: 'K' }), { mac: false })).toBe(true);
  });

  it('given K alone, Ctrl+K on macOS, Cmd+K elsewhere, or another modifier too, says it does not (1)', () => {
    expect(isPaletteShortcut(key(), { mac: true })).toBe(false);
    expect(isPaletteShortcut(key({ ctrlKey: true }), { mac: true })).toBe(false);
    expect(isPaletteShortcut(key({ metaKey: true }), { mac: false })).toBe(false);
    expect(isPaletteShortcut(key({ ctrlKey: true, shiftKey: true }), { mac: false })).toBe(false);
    expect(isPaletteShortcut(key({ ctrlKey: true, altKey: true }), { mac: false })).toBe(false);
    expect(isPaletteShortcut(key({ ctrlKey: true, key: 'j' }), { mac: false })).toBe(false);
  });

  it('given the shortcut while another dialog is open, says it does not: that dialog keeps the keyboard (edge case)', () => {
    expect(isPaletteShortcut(key({ ctrlKey: true }), { mac: false, dialogOpen: true })).toBe(false);
  });

  it('says the shortcut as the platform writes it: ⌘K on macOS, Ctrl+K elsewhere (1)', () => {
    expect(paletteShortcutLabel(true)).toBe('⌘K');
    expect(paletteShortcutLabel(false)).toBe('Ctrl+K');
  });
});

describe('isMac', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('says whether the browser runs on macOS or iOS, where the shortcut uses Cmd (1)', () => {
    for (const [platform, mac] of [['MacIntel', true], ['iPhone', true], ['Win32', false], ['Linux x86_64', false]] as const) {
      vi.stubGlobal('navigator', { platform });

      expect(isMac(), platform).toBe(mac);
    }
  });

  it('says no outside a browser (server rendering)', () => {
    vi.stubGlobal('navigator', undefined);

    expect(isMac()).toBe(false);
  });
});
