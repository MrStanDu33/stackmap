import { describe, expect, it } from 'vitest';

import { collectExtensionLocales } from './extension-locales';

import type { ExtensionManifest } from '@stackmap/extension-sdk';

const manifest = (id: string, contributes: ExtensionManifest['contributes'] = { kinds: {} }): ExtensionManifest => ({
  id,
  version: '1.0.0',
  apiVersion: 1,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn: false,
  dependsOn: [],
  contributes,
});

const appLocales = [
  { code: 'en', language: 'en-US', name: 'English' },
  { code: 'fr', language: 'fr-FR', name: 'Français' },
];
const appMessages = {
  en: { app: { name: 'Stackmap', tagline: 'Infrastructure docs' } },
  fr: { app: { name: 'Stackmap', tagline: 'Documentation d\'infrastructure' } },
};
const german = {
  manifest: manifest('german', { kinds: {}, locales: [{ code: 'de', language: 'de-DE', name: 'Deutsch' }] }),
  messages: {
    en: { extensions: { german: { name: 'German' } } },
    fr: { extensions: { german: { name: 'Allemand' } } },
    de: { app: { name: 'Stackmap' }, extensions: { german: { name: 'Deutsch' } } },
  },
};
const vpn = {
  manifest: manifest('vpn'),
  messages: {
    en: { extensions: { vpn: { name: 'VPN' } } },
    fr: { extensions: { vpn: { name: 'VPN' } } },
    de: { extensions: { vpn: { name: 'VPN' } } },
  },
};

const languages = () => collectExtensionLocales({ appLocales, appMessages, extensions: [german, vpn] });

describe('extension locales build module', () => {
  it('registers every language an extension contributes, with its merged messages', () => {
    expect(languages().map(({ code }) => code)).toEqual(['en', 'fr', 'de']);
    expect(languages()[2]).toEqual({
      code: 'de',
      language: 'de-DE',
      name: 'Deutsch',
      messages: { app: { name: 'Stackmap' }, extensions: { german: { name: 'Deutsch' }, vpn: { name: 'VPN' } } },
      coverage: 0.75,
      missing: ['app.tagline'],
      conflicts: [],
    });
  });

  it('merges English and French from the app and every extension', () => {
    expect(languages()[0]).toMatchObject({
      code: 'en',
      messages: {
        app: { name: 'Stackmap', tagline: 'Infrastructure docs' },
        extensions: { german: { name: 'German' }, vpn: { name: 'VPN' } },
      },
      coverage: 1,
      missing: [],
    });
    expect(languages()[1]?.messages).toEqual({
      app: { name: 'Stackmap', tagline: 'Documentation d\'infrastructure' },
      extensions: { german: { name: 'Allemand' }, vpn: { name: 'VPN' } },
    });
  });
});
