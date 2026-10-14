import { defineExtensionServer } from '@stackmap/extension-sdk';
import { defineEntityRepository } from '@stackmap/extension-sdk/server';
import { createApp, toWebHandler } from 'h3';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from './extensions.get';
import { createExtensionRegistry } from '../extensions/registry';
import { setExtensionRegistry } from '../utils/extensions';

import type { ExtensionManifest, ExtensionServer } from '@stackmap/extension-sdk';

const core: ExtensionManifest = {
  id: 'core',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.core.name',
  description: 'extensions.core.description',
  icon: 'i-lucide-layers',
  alwaysOn: true,
  dependsOn: [],
  contributes: { kinds: { network: [{ id: 'lan', label: 'extensions.core.kinds.network.lan', icon: 'i-lucide-network' }] } },
};

const vpn: ExtensionManifest = {
  id: 'vpn',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.vpn.name',
  description: 'extensions.vpn.description',
  icon: '/extensions/vpn/wireguard.svg',
  alwaysOn: false,
  dependsOn: ['core'],
  contributes: { kinds: { network: [{ id: 'vpn', label: 'extensions.vpn.kinds.network.vpn' }] } },
};

const get = async (manifests: ExtensionManifest[], servers: ExtensionServer[] = []) => {
  setExtensionRegistry(createExtensionRegistry(manifests, { servers }));
  const response = await toWebHandler(createApp().use('/api/extensions', handler))(
    new Request('http://localhost/api/extensions'),
  );
  return { status: response.status, json: await response.json() as { extensions: Record<string, unknown>[] } };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/extensions', () => {
  it('returns every installed extension with its keys, icon, alwaysOn, dependsOn, enabled and kinds by entity', async () => {
    expect(await get([vpn, core])).toEqual({
      status: 200,
      json: {
        extensions: [
          {
            id: 'core',
            version: '1.0.0',
            name: 'extensions.core.name',
            description: 'extensions.core.description',
            icon: 'i-lucide-layers',
            alwaysOn: true,
            dependsOn: [],
            state: 'active',
            enabled: true,
            kinds: {
              host: [],
              network: [{ id: 'lan', label: 'extensions.core.kinds.network.lan', icon: 'i-lucide-network' }],
              service: [],
              protocol: [],
            },
            entities: [],
            locales: [],
          },
          {
            id: 'vpn',
            version: '1.0.0',
            name: 'extensions.vpn.name',
            description: 'extensions.vpn.description',
            icon: '/extensions/vpn/wireguard.svg',
            alwaysOn: false,
            dependsOn: ['core'],
            state: 'active',
            enabled: true,
            kinds: { host: [], network: [{ id: 'vpn', label: 'extensions.vpn.kinds.network.vpn' }], service: [], protocol: [] },
            entities: [],
            locales: [],
          },
        ],
      },
    });
  });

  it('given a Lucide icon the app does not bundle, leaves the icon out and logs a warning', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken: ExtensionManifest = {
      ...core,
      icon: 'i-lucide-not-a-real-icon',
      contributes: { kinds: { network: [{ id: 'lan', label: 'extensions.core.kinds.network.lan', icon: 'i-lucide-nope' }] } },
    };

    const { json } = await get([broken]);

    expect(json.extensions[0]).not.toHaveProperty('icon');
    expect(json.extensions[0]).toHaveProperty(['kinds', 'network', 0], { id: 'lan', label: 'extensions.core.kinds.network.lan' });
    expect(warned).toHaveBeenCalledWith(expect.stringMatching(/i-lucide-not-a-real-icon/));
    expect(warned).toHaveBeenCalledWith(expect.stringMatching(/i-lucide-nope/));
  });

  it('requires the viewer role', () => {
    expect(handler.contract.requiredRole).toBe('viewer');
  });
});

describe('GET /api/extensions: states and locales', () => {
  it('adds each extension\'s state and contributed locales; failed extensions contribute nothing', async () => {
    const german: ExtensionManifest = {
      ...vpn,
      id: 'german',
      name: 'extensions.german.name',
      description: 'extensions.german.description',
      icon: undefined,
      dependsOn: [],
      contributes: { kinds: {}, locales: [{ code: 'de', language: 'de-DE', name: 'Deutsch' }] },
    };
    const broken: ExtensionManifest = { ...german, id: 'broken', apiVersion: 99 };

    const { json } = await get([german, broken]);

    // Registry order (dependencies first, then id), whatever the state.
    expect(json.extensions.map(({ id, state, locales, kinds }) => ({ id, state, locales, kinds }))).toEqual([
      { id: 'broken', state: 'failed', locales: [], kinds: { host: [], network: [], service: [], protocol: [] } },
      {
        id: 'german',
        state: 'active',
        locales: [{ code: 'de', language: 'de-DE', name: 'Deutsch' }],
        kinds: { host: [], network: [], service: [], protocol: [] },
      },
    ]);
  });
});

describe('GET /api/extensions: entities', () => {
  it('lists each extension\'s entities with their id and label', async () => {
    const withHosts: ExtensionManifest = {
      ...core,
      code: { server: true },
      contributes: { ...core.contributes, entities: [{ id: 'host', table: 'core_host', label: 'extensions.core.entities.host' }] },
    };
    const hosts = defineEntityRepository({
      entity: 'host', key: 'hosts', table: 'core_host', schema: { input: {}, patch: {} } as never, columns: [],
    });

    const { status, json } = await get([withHosts, vpn], [defineExtensionServer(withHosts, { repositories: [hosts] })]);

    expect(status).toBe(200);
    expect(json.extensions.map(({ id, entities }) => ({ id, entities }))).toEqual([
      { id: 'core', entities: [{ id: 'host', label: 'extensions.core.entities.host' }] },
      { id: 'vpn', entities: [] },
    ]);
  });
});
