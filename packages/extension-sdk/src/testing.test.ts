import { describe, expect, it } from 'vitest';

import { checkExtension } from './testing';

import type { ExtensionManifest } from './manifest';
import type { ExtensionFiles } from './testing';

const vpn: ExtensionManifest = {
  id: 'vpn',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.vpn.name',
  description: 'extensions.vpn.description',
  icon: 'i-lucide-shield',
  alwaysOn: false,
  dependsOn: [],
  contributes: {
    kinds: { network: [{ id: 'vpn', label: 'extensions.vpn.kinds.network.vpn', icon: '/extensions/vpn/wireguard.svg' }] },
  },
};

const files = (): ExtensionFiles => ({
  messages: {
    en: { extensions: { vpn: { name: 'VPN', description: 'Private networks', kinds: { network: { vpn: 'VPN' } } } } },
    fr: { extensions: { vpn: { name: 'VPN', description: 'Réseaux privés', kinds: { network: { vpn: 'VPN' } } } } },
  },
  publicFiles: ['extensions/vpn/wireguard.svg'],
});

describe('checkExtension', () => {
  it('given English and French messages with every key of the manifest, reports no problem', () => {
    expect(checkExtension(vpn, files())).toEqual([]);
  });

  it('given a key missing from one locale, reports the key and the locale', () => {
    const { messages, publicFiles } = files();
    const fr = { extensions: { vpn: { name: 'VPN', description: 'Réseaux privés' } } };

    expect(checkExtension(vpn, { messages: { ...messages, fr }, publicFiles }))
      .toEqual(['extensions.vpn.kinds.network.vpn is missing in fr']);
  });

  it('given locales whose keys differ, reports the keys missing on each side', () => {
    const { messages, publicFiles } = files();
    const en = { extensions: { vpn: { ...(messages.en?.extensions as { vpn: object }).vpn, peers: 'Peers' } } };
    const fr = { extensions: { vpn: { ...(messages.fr?.extensions as { vpn: object }).vpn, tunnel: 'Tunnel' } } };

    expect(checkExtension(vpn, { messages: { en, fr }, publicFiles }).sort()).toEqual([
      'extensions.vpn.peers is missing in fr',
      'extensions.vpn.tunnel is missing in en',
    ]);
  });

  it('given no English or no French messages, reports the missing locale', () => {
    const { messages, publicFiles } = files();

    expect(checkExtension(vpn, { messages: { en: messages.en ?? {} }, publicFiles })).toEqual(['fr messages are missing']);
    expect(checkExtension(vpn, { messages: { fr: messages.fr ?? {} }, publicFiles })).toEqual(['en messages are missing']);
  });

  it('given an empty message, reports the key and the locale', () => {
    const { messages, publicFiles } = files();
    const fr = { extensions: { vpn: { name: ' ', description: 'Réseaux privés', kinds: { network: { vpn: 'VPN' } } } } };

    expect(checkExtension(vpn, { messages: { ...messages, fr }, publicFiles }))
      .toEqual(['extensions.vpn.name is empty in fr']);
  });

  it('given a locale key outside extensions.<id>., reports it: an extension cannot override other strings', () => {
    const { messages, publicFiles } = files();
    const en = { ...messages.en, app: { name: 'Hijacked' } };
    const fr = { ...messages.fr, app: { name: 'Détourné' } };

    expect(checkExtension(vpn, { messages: { en, fr }, publicFiles })).toEqual(['app.name is outside extensions.vpn.']);
  });

  it('given a public file outside public/extensions/<id>/, reports it: an extension cannot override other files', () => {
    const publicFiles = ['extensions/vpn/wireguard.svg', 'favicon.ico', 'extensions/core/logo.svg'];

    expect(checkExtension(vpn, { ...files(), publicFiles })).toEqual([
      'public/favicon.ico is outside public/extensions/vpn/',
      'public/extensions/core/logo.svg is outside public/extensions/vpn/',
    ]);
  });

  it('given a Lucide icon that does not exist or an image missing from public/, reports the icon; no icon is fine', () => {
    const broken: ExtensionManifest = { ...vpn, icon: 'i-lucide-not-a-real-icon' };

    expect(checkExtension(broken, { ...files(), publicFiles: [] })).toEqual([
      'icon i-lucide-not-a-real-icon does not exist in Lucide',
      'icon /extensions/vpn/wireguard.svg is missing from public/',
    ]);

    const withoutIcons: ExtensionManifest = {
      ...vpn,
      icon: undefined,
      contributes: { kinds: { network: [{ id: 'vpn', label: 'extensions.vpn.kinds.network.vpn' }] } },
    };
    expect(checkExtension(withoutIcons, { ...files(), publicFiles: [] })).toEqual([]);
  });
});

describe('checkExtension: locale packs', () => {
  const pack: ExtensionManifest = {
    id: 'german',
    version: '1.0.0',
    apiVersion: 1,
    name: 'extensions.german.name',
    description: 'extensions.german.description',
    alwaysOn: false,
    dependsOn: [],
    contributes: { kinds: {}, locales: [{ code: 'de', language: 'de-DE', name: 'Deutsch' }] },
  };
  const en = { extensions: { german: { name: 'German', description: 'German for Stackmap' } } };
  const fr = { extensions: { german: { name: 'Allemand', description: 'L\'allemand pour Stackmap' } } };

  it('in a language the extension contributes, accepts any key; in other languages, keeps to its namespace', () => {
    const de = { app: { name: 'Stackmap' }, extensions: { german: { name: 'Deutsch' }, vpn: { name: 'VPN' } } };

    expect(checkExtension(pack, { messages: { en, fr, de }, publicFiles: [] })).toEqual([]);
    expect(checkExtension(pack, { messages: { en, fr: { ...fr, app: { name: 'Stackmap' } }, de }, publicFiles: [] }))
      .toEqual(['app.name is outside extensions.german.']);
  });

  it('reports keys missing from a contributed language as coverage, not as problems', () => {
    expect(checkExtension(pack, { messages: { en, fr, de: { app: { name: 'Stackmap' } } }, publicFiles: [] }))
      .toEqual([]);
  });

  it('reports a message whose placeholders differ from English, in every locale file', () => {
    const withPeers = (messages: typeof en, peers: string) =>
      ({ extensions: { german: { ...messages.extensions.german, peers } } });

    expect(checkExtension(pack, {
      messages: {
        en: withPeers(en, '{count} peers'),
        fr: withPeers(fr, '{total} pairs'),
        de: { app: { greeting: 'Hallo {user}' }, extensions: { german: { peers: '{count} Gegenstellen {extra}' } } },
      },
      publicFiles: [],
      reference: { app: { greeting: 'Hello {name}' } },
    }).sort()).toEqual([
      'app.greeting has {user} in de but {name} in English',
      'extensions.german.peers has {count} {extra} in de but {count} in English',
      'extensions.german.peers has {total} in fr but {count} in English',
    ]);
  });
});

describe('checkExtension: entities', () => {
  it('reports an entity label missing from English or French', () => {
    const withPeer: ExtensionManifest = {
      ...vpn,
      contributes: { ...vpn.contributes, entities: [{ id: 'peer', table: 'vpn_peer', label: 'extensions.vpn.entities.peer' }] },
    };
    const { messages, publicFiles } = files();
    const en = { extensions: { vpn: { ...(messages.en?.extensions as { vpn: object }).vpn, entities: { peer: 'Peer' } } } };

    expect(checkExtension(withPeer, { messages: { ...messages, en }, publicFiles }))
      .toEqual(['extensions.vpn.entities.peer is missing in fr']);
  });
});
