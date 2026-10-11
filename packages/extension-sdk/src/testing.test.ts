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
