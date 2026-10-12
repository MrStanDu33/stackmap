import { describe, expect, it } from 'vitest';

import { localeCoverage, mergeLocaleMessages } from './locales';

import type { LocaleSource } from './locales';

/** German from the app, a German pack, the VPN extension and another pack, in registry order. */
const sources: LocaleSource[] = [
  { extension: null, messages: { app: { name: 'Stackmap' } } },
  {
    extension: 'german',
    declares: true,
    messages: { app: { name: 'Stackmap DE', title: 'Infrastruktur' }, extensions: { vpn: { name: 'VPN (Paket)' } } },
  },
  { extension: 'vpn', messages: { extensions: { vpn: { name: 'VPN', peers: 'Gegenstellen' } } } },
  { extension: 'other-pack', declares: true, messages: { app: { title: 'Infra' } } },
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

describe('mergeLocaleMessages: who may translate', () => {
  it('in a language, only the key\'s owner and the extensions declaring that language translate it', () => {
    const { messages, conflicts } = mergeLocaleMessages('de', [
      { extension: null, messages: {} },
      // Does not declare German: it may only translate its own keys.
      { extension: 'audit', messages: { app: { warning: 'Harmlos' }, extensions: { audit: { name: 'Prüfung' } } } },
      { extension: 'german', declares: true, messages: { app: { warning: 'Führt Code aus' } } },
    ]);

    expect(messages).toEqual({ app: { warning: 'Führt Code aus' }, extensions: { audit: { name: 'Prüfung' } } });
    expect(conflicts).toEqual([]);
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
