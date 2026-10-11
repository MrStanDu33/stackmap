import { EXTENSION_API_VERSION } from '@stackmap/extension-sdk';
import { describe, expect, it } from 'vitest';

import { createExtensionRegistry, ExtensionRegistryError } from './registry';

import type { ExtensionManifest, KindContributions } from '@stackmap/extension-sdk';

const manifest = (
  id: string,
  { alwaysOn = false, dependsOn = [], kinds = {}, apiVersion = EXTENSION_API_VERSION }:
  { alwaysOn?: boolean; dependsOn?: string[]; kinds?: KindContributions; apiVersion?: number } = {},
): ExtensionManifest => ({
  id,
  version: '1.0.0',
  apiVersion,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn,
  dependsOn,
  contributes: { kinds },
});

const kind = (extension: string, id: string) => ({ id, label: `extensions.${extension}.kinds.${id}` });

/** The problems of the registry error thrown by `create`. */
const problemsOf = (create: () => unknown): readonly string[] => {
  try {
    create();
  } catch (error) {
    if (error instanceof ExtensionRegistryError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('The registry was created');
};

describe('createExtensionRegistry', () => {
  it('given valid manifests, lists them with dependencies first, then by id', () => {
    const registry = createExtensionRegistry([
      manifest('proxy', { dependsOn: ['tls'] }),
      manifest('vpn'),
      manifest('tls'),
      manifest('core', { alwaysOn: true }),
    ]);

    expect(registry.extensions.map(({ id }) => id)).toEqual(['core', 'tls', 'proxy', 'vpn']);
    expect(registry.get('tls')).toMatchObject({ id: 'tls' });
    expect(registry.get('backups')).toBeUndefined();
  });

  it('given two extensions with the same id, fails naming the id', () => {
    expect(problemsOf(() => createExtensionRegistry([manifest('vpn'), manifest('vpn')])))
      .toEqual(['extension "vpn" is installed twice']);
  });

  it('given a dependency that is not installed, fails naming the extension and the dependency', () => {
    expect(problemsOf(() => createExtensionRegistry([manifest('proxy', { dependsOn: ['tls'] })])))
      .toEqual(['"proxy" depends on "tls", which is not installed']);
  });

  it('given a dependency cycle, fails naming the cycle', () => {
    expect(problemsOf(() => createExtensionRegistry([
      manifest('a', { dependsOn: ['b'] }),
      manifest('b', { dependsOn: ['c'] }),
      manifest('c', { dependsOn: ['a'] }),
      manifest('d'),
    ]))).toEqual(['dependency cycle: a → b → c → a']);
  });

  it('given an apiVersion the SDK does not support, fails naming the supported version', () => {
    expect(problemsOf(() => createExtensionRegistry([manifest('vpn', { apiVersion: EXTENSION_API_VERSION + 1 })])))
      .toEqual([`"vpn" targets extension API ${String(EXTENSION_API_VERSION + 1)}; this Stackmap supports ${String(EXTENSION_API_VERSION)}`]);
  });

  it('given an always-on extension depending on one that is not always on, fails', () => {
    expect(problemsOf(() => createExtensionRegistry([
      manifest('core', { alwaysOn: true, dependsOn: ['tls'] }),
      manifest('tls'),
    ]))).toEqual(['"core" is always on but depends on "tls", which can be turned off']);
  });

  it('given two extensions contributing the same kind for the same entity, fails naming the kind and both extensions', () => {
    expect(problemsOf(() => createExtensionRegistry([
      manifest('vpn', { kinds: { network: [kind('vpn', 'vpn')] } }),
      manifest('wireguard', { kinds: { network: [kind('wireguard', 'vpn')], service: [kind('wireguard', 'vpn')] } }),
    ]))).toEqual(['network kind "vpn" is contributed by both "vpn" and "wireguard"']);
  });

  it('given several problems, fails with an ExtensionRegistryError listing all of them', () => {
    let error: unknown;
    try {
      createExtensionRegistry([manifest('vpn'), manifest('vpn'), manifest('proxy', { dependsOn: ['tls'] })]);
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(ExtensionRegistryError);
    expect(error).toMatchObject({
      problems: ['extension "vpn" is installed twice', '"proxy" depends on "tls", which is not installed'],
      message: expect.stringMatching(/- extension "vpn" is installed twice\n- "proxy" depends on "tls"/) as string,
    });
  });

  it('kinds(entity) returns the kinds of every extension, with the contributing extension, in registry order', () => {
    const registry = createExtensionRegistry([
      manifest('vpn', { kinds: { network: [kind('vpn', 'vpn')] } }),
      manifest('core', { alwaysOn: true, kinds: { network: [kind('core', 'lan'), kind('core', 'dmz')] } }),
    ]);

    expect(registry.kinds('network')).toEqual([
      { ...kind('core', 'lan'), extension: 'core' },
      { ...kind('core', 'dmz'), extension: 'core' },
      { ...kind('vpn', 'vpn'), extension: 'vpn' },
    ]);
    expect(registry.kinds('protocol')).toEqual([]);
  });

  it('hasKind(entity, id) says whether an installed extension contributes that kind', () => {
    const registry = createExtensionRegistry([manifest('vpn', { kinds: { network: [kind('vpn', 'vpn')] } })]);

    expect(registry.hasKind('network', 'vpn')).toBe(true);
    expect(registry.hasKind('network', 'docker')).toBe(false);
    expect(registry.hasKind('host', 'vpn')).toBe(false);
  });
});
