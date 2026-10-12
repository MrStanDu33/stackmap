import { describe, expect, it } from 'vitest';

import { localeCoverage, mergeLocaleMessages } from './locales';

import type { LocaleSource } from './locales';

/** German from the app, a German pack, the VPN extension and another pack, in registry order. */
const sources: LocaleSource[] = [
  { extension: null, messages: { app: { name: 'Stackmap' } } },
  {
    extension: 'german',
    messages: { app: { name: 'Stackmap DE', title: 'Infrastruktur' }, extensions: { vpn: { name: 'VPN (Paket)' } } },
  },
  { extension: 'vpn', messages: { extensions: { vpn: { name: 'VPN', peers: 'Gegenstellen' } } } },
  { extension: 'other-pack', messages: { app: { title: 'Infra' } } },
];

describe('mergeLocaleMessages', () => {
  it('merges every extension\'s messages for a language: the key\'s owner wins, then registry order', () => {
    expect(mergeLocaleMessages('de', sources).messages).toEqual({
      app: { name: 'Stackmap', title: 'Infrastruktur' },
      extensions: { vpn: { name: 'VPN', peers: 'Gegenstellen' } },
    });
  });

  it('returns the conflicts: key, language, winner and ignored extensions', () => {
    expect(mergeLocaleMessages('de', sources).conflicts).toEqual([
      { key: 'app.name', language: 'de', winner: null, ignored: ['german'] },
      { key: 'app.title', language: 'de', winner: 'german', ignored: ['other-pack'] },
      { key: 'extensions.vpn.name', language: 'de', winner: 'vpn', ignored: ['german'] },
    ]);
  });
});

describe('localeCoverage', () => {
  it('gives the share of English keys a language translates, and the missing keys', () => {
    const english = { a: { b: 'B', c: 'C' }, d: 'D', e: 'E' };

    expect(localeCoverage(english, { a: { b: 'b' }, d: ' ', x: 'extra' })).toEqual({
      coverage: 0.25,
      missing: ['a.c', 'd', 'e'],
    });
  });
});
