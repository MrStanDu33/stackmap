import { defineExtensionServer, EXTENSION_API_VERSION } from '@stackmap/extension-sdk';
import { defineEntityRepository } from '@stackmap/extension-sdk/server';
import { describe, expect, it } from 'vitest';

import { createExtensionRegistry, ExtensionRegistryError } from './registry';

import type {
  ExtensionManifest, ExtensionServer, KindContributions, LocaleDeclaration,
} from '@stackmap/extension-sdk';

interface Options {
  alwaysOn?: boolean;
  dependsOn?: string[];
  kinds?: KindContributions;
  locales?: LocaleDeclaration[];
  code?: ExtensionManifest['code'];
  apiVersion?: number;
  version?: string;
}

const manifest = (id: string, { kinds = {}, locales, apiVersion = EXTENSION_API_VERSION, ...rest }: Options = {}) => ({
  id,
  version: rest.version ?? '1.0.0',
  apiVersion,
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn: rest.alwaysOn ?? false,
  dependsOn: rest.dependsOn ?? [],
  ...(rest.code ? { code: rest.code } : {}),
  contributes: { kinds, ...(locales ? { locales } : {}) },
}) satisfies ExtensionManifest;

const kind = (extension: string, id: string) => ({ id, label: `extensions.${extension}.kinds.${id}` });

const APP_LOCALES: LocaleDeclaration[] = [
  { code: 'en', language: 'en-US', name: 'English' },
  { code: 'fr', language: 'fr-FR', name: 'Français' },
];

/** `id state: errors` for every extension, in registry order. */
const summary = (manifests: ExtensionManifest[], options = {}) =>
  createExtensionRegistry(manifests, options).extensions.map(({ manifest: { id }, state, errors }) =>
    (errors.length > 0 ? `${id} ${state}: ${errors.join('; ')}` : `${id} ${state}`));

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

    expect(registry.extensions.map(({ manifest: { id } }) => id)).toEqual(['core', 'tls', 'proxy', 'vpn']);
    expect(registry.active.map(({ id }) => id)).toEqual(['core', 'tls', 'proxy', 'vpn']);
    expect(registry.get('tls')).toMatchObject({ manifest: { id: 'tls' }, state: 'active', errors: [] });
    expect(registry.get('backups')).toBeUndefined();
  });

  it('marks failed an extension installed twice: the later one', () => {
    expect(summary([manifest('vpn'), manifest('vpn', { version: '2.0.0' })]))
      .toEqual(['vpn active', 'vpn failed: is installed twice']);
  });

  it('marks failed an extension whose dependency is not installed, naming it', () => {
    expect(summary([manifest('proxy', { dependsOn: ['tls'] })]))
      .toEqual(['proxy failed: depends on "tls", which is not installed']);
  });

  it('marks failed the extensions of a dependency cycle, naming the cycle', () => {
    expect(summary([
      manifest('a', { dependsOn: ['b'] }),
      manifest('b', { dependsOn: ['c'] }),
      manifest('c', { dependsOn: ['a'] }),
      manifest('d'),
    ])).toEqual([
      'd active',
      'a failed: is in a dependency cycle: a → b → c → a',
      'b failed: is in a dependency cycle: a → b → c → a',
      'c failed: is in a dependency cycle: a → b → c → a',
    ]);
  });

  it('marks failed an extension targeting an unsupported apiVersion, naming the supported version', () => {
    expect(summary([manifest('vpn', { apiVersion: EXTENSION_API_VERSION + 1 })])).toEqual([
      `vpn failed: targets extension API ${String(EXTENSION_API_VERSION + 1)}; `
      + `this Stackmap supports ${String(EXTENSION_API_VERSION)}`,
    ]);
  });

  it('given an always-on extension depending on one that is not always on, throws', () => {
    expect(problemsOf(() => createExtensionRegistry([
      manifest('core', { alwaysOn: true, dependsOn: ['tls'] }),
      manifest('tls'),
    ]))).toEqual(['"core" is always on but depends on "tls", which can be turned off']);
  });

  it('marks failed the later extension contributing the same kind for the same entity, naming both', () => {
    expect(summary([
      manifest('vpn', { kinds: { network: [kind('vpn', 'vpn')] } }),
      manifest('wireguard', { kinds: { network: [kind('wireguard', 'vpn')], service: [kind('wireguard', 'vpn')] } }),
    ])).toEqual(['vpn active', 'wireguard failed: adds network kind "vpn", which "vpn" already adds']);
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

describe('createExtensionRegistry: states', () => {
  it('gives each extension a state, active or failed with its errors', () => {
    const registry = createExtensionRegistry([manifest('vpn'), manifest('proxy', { dependsOn: ['tls'] })]);

    expect(registry.get('vpn')).toMatchObject({ state: 'active', errors: [] });
    expect(registry.get('proxy')).toMatchObject({
      state: 'failed',
      errors: ['depends on "tls", which is not installed'],
    });
    expect(registry.active.map(({ id }) => id)).toEqual(['vpn']);
  });

  it('marks the later extension failed on a duplicate id, a kind conflict or a locale declared differently', () => {
    const deutsch = { code: 'de', language: 'de-DE', name: 'Deutsch' };

    expect(summary([
      manifest('a', { locales: [deutsch] }),
      manifest('b', { locales: [{ ...deutsch, name: 'German' }] }),
      manifest('c', { locales: [deutsch, { code: 'fr', language: 'fr-FR', name: 'French' }] }),
      manifest('d', { locales: [deutsch, { code: 'fr', language: 'fr-FR', name: 'Français' }] }),
    ], { appLocales: APP_LOCALES })).toEqual([
      'a active',
      'b failed: declares locale "de" as German (de-DE), which "a" declares as Deutsch (de-DE)',
      'c failed: declares locale "fr" as French (fr-FR), which the app declares as Français (fr-FR)',
      'd active',
    ]);
  });

  it('marks failed an extension whose code is declared but not shipped, or shipped but not declared', () => {
    const servers: ExtensionServer[] = [{ extension: 'shipped', hooks: {} }, { extension: 'both', hooks: {} }];

    expect(summary([
      manifest('declared', { code: { server: true } }),
      manifest('shipped'),
      manifest('both', { code: { server: true } }),
    ], { servers })).toEqual([
      'both active',
      'declared failed: declares code.server but ships no server code',
      'shipped failed: ships server code but does not declare code.server',
    ]);
    expect(createExtensionRegistry([manifest('both', { code: { server: true } })], { servers }).get('both')?.server)
      .toBe(servers[1]);
  });

  it('marks failed the dependents of a failed extension, naming the extension they needed', () => {
    expect(summary([
      manifest('tls', { apiVersion: EXTENSION_API_VERSION + 1 }),
      manifest('proxy', { dependsOn: ['tls'] }),
      manifest('waf', { dependsOn: ['proxy'] }),
    ])).toEqual([
      `tls failed: targets extension API ${String(EXTENSION_API_VERSION + 1)}; `
      + `this Stackmap supports ${String(EXTENSION_API_VERSION)}`,
      'proxy failed: needs "tls", which failed',
      'waf failed: needs "proxy", which failed',
    ]);
  });

  it('given a failed always-on extension, throws with every problem', () => {
    expect(problemsOf(() => createExtensionRegistry([
      manifest('core', { alwaysOn: true, apiVersion: EXTENSION_API_VERSION + 1 }),
      manifest('vpn', { dependsOn: ['missing'] }),
    ]))).toEqual([
      `"core" targets extension API ${String(EXTENSION_API_VERSION + 1)}; `
      + `this Stackmap supports ${String(EXTENSION_API_VERSION)}`,
      '"vpn" depends on "missing", which is not installed',
    ]);
  });

  it('failed extensions contribute nothing: no kinds, no hooks, no locales', () => {
    const registry = createExtensionRegistry([
      manifest('vpn', {
        apiVersion: EXTENSION_API_VERSION + 1,
        kinds: { network: [kind('vpn', 'vpn')] },
        locales: [{ code: 'de', language: 'de-DE', name: 'Deutsch' }],
      }),
    ]);

    expect(registry.kinds('network')).toEqual([]);
    expect(registry.hasKind('network', 'vpn')).toBe(false);
    expect(registry.locales()).toEqual([]);
    expect(registry.active).toEqual([]);
  });

  it('fail(id) marks an extension and its dependents failed at runtime; failing an always-on extension throws', () => {
    const registry = createExtensionRegistry([
      manifest('core', { alwaysOn: true }),
      manifest('tls'),
      manifest('proxy', { dependsOn: ['tls'] }),
    ]);

    registry.fail('tls', 'setup failed: certificate store unreachable');

    expect(registry.extensions.map(({ manifest: { id }, state, errors }) => [id, state, errors])).toEqual([
      ['core', 'active', []],
      ['tls', 'failed', ['setup failed: certificate store unreachable']],
      ['proxy', 'failed', ['needs "tls", which failed']],
    ]);
    expect(() => {
      registry.fail('core', 'setup failed: boom');
    }).toThrow(ExtensionRegistryError);
  });

  it('masks credentials in the errors it lists, for diagnostics', () => {
    const registry = createExtensionRegistry([manifest('vpn')]);

    registry.fail('vpn', 'setup failed: cannot reach postgres://stackmap:secret@db/stackmap?password=hunter2');

    const masked = ['setup failed: cannot reach postgres://stackmap:***@db/stackmap?password=***'];
    expect(registry.get('vpn')?.errors).toEqual(masked);
    expect(registry.extensions[0]?.errors).toEqual(masked);
  });

  it('masks the whole password when it contains @', () => {
    const registry = createExtensionRegistry([manifest('vpn')]);

    registry.fail('vpn', 'cannot reach postgres://user:p@ss@db/x');

    expect(registry.get('vpn')?.errors).toEqual(['cannot reach postgres://user:***@db/x']);
  });

  it('cuts each listed error to 1000 characters, after masking it', () => {
    const registry = createExtensionRegistry([manifest('vpn')]);

    registry.fail('vpn', `token=${'s'.repeat(1500)} end`);
    registry.fail('vpn', 'x'.repeat(1500));

    const [masked, long = ''] = registry.get('vpn')?.errors ?? [];
    expect(masked).toBe('token=*** end');
    expect(long).toBe(`${'x'.repeat(999)}…`);
  });

  it('lists every error, so the startup log has them all; diagnostics cap them', () => {
    const registry = createExtensionRegistry([manifest('vpn')]);

    for (let index = 1; index <= 60; index += 1) {
      registry.fail('vpn', `error ${String(index)}`);
    }

    const errors = registry.get('vpn')?.errors ?? [];
    expect(errors).toHaveLength(60);
    expect(errors[59]).toBe('error 60');
  });
});

describe('extension registry: entities', () => {
  const entity = (extension: string, id: string, table = `${extension}_${id}`) =>
    ({ id, table, label: `extensions.${extension}.entities.${id}` });
  const withEntities = (id: string, entities: ReturnType<typeof entity>[], options: Options = {}) => {
    const base = manifest(id, { ...options, code: { server: true } });
    return { ...base, contributes: { ...base.contributes, entities } } satisfies ExtensionManifest;
  };
  const repository = (entityId: string, key: string, table: string) =>
    defineEntityRepository({ entity: entityId, key, table, schema: { input: {}, patch: {} } as never, columns: [] });
  const serverOf = (extension: ExtensionManifest, repositories: ReturnType<typeof repository>[]) =>
    defineExtensionServer(extension, { repositories });

  it('given a table outside the extension\'s prefix (another extension\'s, or a platform table), fails it: the registry re-validates manifests', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'thing', 'alpha_thing')]);
    const gamma = withEntities('gamma', [entity('gamma', 'thing', 'workspace')]);

    expect(summary([alpha, beta, gamma], {
      servers: [
        serverOf(alpha, [repository('thing', 'alphaThings', 'alpha_thing')]),
        serverOf(beta, [repository('thing', 'betaThings', 'alpha_thing')]),
        serverOf(gamma, [repository('thing', 'gammaThings', 'workspace')]),
      ],
    })).toEqual([
      'alpha active',
      expect.stringMatching(/^beta failed: contributes\.entities\.0\.table: must be beta_/),
      expect.stringMatching(/^gamma failed: contributes\.entities\.0\.table: must be gamma_/),
    ]);
  });

  it('given dependentsOf on an entity of a dependency, adds the declaring table to that entity\'s dependents', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'part')], { dependsOn: ['alpha'] });
    const part = {
      ...repository('part', 'parts', 'beta_part'),
      columns: ['thingId'],
      dependentsOf: [{ entity: 'thing', column: 'thingId' }],
    };

    const registry = createExtensionRegistry([alpha, beta], {
      servers: [serverOf(alpha, [repository('thing', 'things', 'alpha_thing')]), serverOf(beta, [part])],
    });

    expect(registry.repositories().find(({ key }) => key === 'things')?.dependents)
      .toEqual([{ entity: 'part', table: 'beta_part', column: 'thingId' }]);
  });

  it('given dependentsOf on an entity of an extension it does not depend on, or an unknown entity, fails the extension with a diagnostic', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'part')]);
    const part = (target: string) =>
      ({ ...repository('part', 'parts', 'beta_part'), columns: ['thingId'], dependentsOf: [{ entity: target, column: 'thingId' }] });

    for (const target of ['thing', 'unknown']) {
      expect(summary([alpha, beta], {
        servers: [serverOf(alpha, [repository('thing', 'things', 'alpha_thing')]), serverOf(beta, [part(target)])],
      }), target).toEqual([
        'alpha active',
        `beta failed: repository "parts" counts as a dependent of entity "${target}", which none of its dependencies declares`,
      ]);
    }
  });

  it('given dependentsOf through a column its table does not store, fails the extension naming the column', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'part')], { dependsOn: ['alpha'] });
    const part = {
      ...repository('part', 'parts', 'beta_part'),
      columns: ['thingId'],
      dependentsOf: [{ entity: 'thing', column: 'thingRef' }],
    };

    expect(summary([alpha, beta], {
      servers: [serverOf(alpha, [repository('thing', 'things', 'alpha_thing')]), serverOf(beta, [part])],
    })).toEqual([
      'alpha active',
      'beta failed: repository "parts" counts as a dependent through column "thingRef", which it does not store',
    ]);
  });

  describe('dependentsOf through a dependency\'s table', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'owner'), entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'part')], { dependsOn: ['alpha'] });
    const alphaServer = serverOf(alpha, [
      repository('owner', 'owners', 'alpha_owner'),
      { ...repository('thing', 'things', 'alpha_thing'), columns: ['ownerId'] },
    ]);
    const part = (through: { table: string; column: string }) => ({
      ...repository('part', 'parts', 'beta_part'),
      columns: ['thingId'],
      dependentsOf: [{ entity: 'owner', column: 'thingId', through }],
    });

    it('adds it to that entity\'s dependents, with the table it goes through', () => {
      const registry = createExtensionRegistry([alpha, beta], {
        servers: [alphaServer, serverOf(beta, [part({ table: 'alpha_thing', column: 'ownerId' })])],
      });

      expect(registry.repositories().find(({ key }) => key === 'owners')?.dependents).toEqual([
        { entity: 'part', table: 'beta_part', column: 'thingId', through: { table: 'alpha_thing', column: 'ownerId' } },
      ]);
    });

    it('given a table no dependency\'s repository stores, or a column it does not store, fails the extension', () => {
      for (const through of [{ table: 'gamma_thing', column: 'ownerId' }, { table: 'alpha_thing', column: 'nope' }]) {
        const servers = [alphaServer, serverOf(beta, [part(through)])];

        expect(summary([alpha, beta], { servers }), through.table).toEqual([
          'alpha active',
          `beta failed: repository "parts" counts as a dependent through "${through.table}.${through.column}", `
          + 'which no repository of its dependencies stores',
        ]);
      }
    });
  });

  it('given two extensions defining the same repository key, fails the later one naming the other', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'thing')]);

    expect(summary([alpha, beta], {
      servers: [serverOf(alpha, [repository('thing', 'things', 'alpha_thing')]), serverOf(beta, [repository('thing', 'things', 'beta_thing')])],
    })).toEqual(['alpha active', 'beta failed: defines repository "things", which "alpha" already defines']);
  });

  it('given a repository for an entity the manifest does not declare, or a declared entity without a repository, fails the extension naming the entity', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);

    expect(summary([alpha], { servers: [serverOf(alpha, [repository('other', 'others', 'alpha_other')])] })).toEqual([
      'alpha failed: defines a repository for entity "other", which its manifest does not declare; '
      + 'declares entity "thing" but defines no repository for it',
    ]);
  });

  it('given a repository whose table is not the one the manifest declares, fails the extension', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);

    expect(summary([alpha], { servers: [serverOf(alpha, [repository('thing', 'things', 'alpha_other')])] })).toEqual([
      'alpha failed: stores entity "thing" in table "alpha_other", but its manifest declares "alpha_thing"',
    ]);
  });

  it('given a repository key that is not camelCase, too long, or transaction, fails the extension', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    for (const key of ['transaction', 'Things', 'some-things', '__proto__', `t${'h'.repeat(40)}`]) {
      expect(summary([alpha], { servers: [serverOf(alpha, [repository('thing', key, 'alpha_thing')])] }), key)
        .toEqual([expect.stringMatching(new RegExp(`^alpha failed: defines repository "${key}"`))]);
    }
  });

  it('given a definition that stores, filters or owns a field the repository sets, fails only that extension', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'thing')]);
    const bad = { ...repository('thing', 'betaThings', 'beta_thing'), columns: ['workspaceId'] };

    expect(summary([alpha, beta], {
      servers: [serverOf(alpha, [repository('thing', 'alphaThings', 'alpha_thing')]), serverOf(beta, [bad])],
    })).toEqual(['alpha active', 'beta failed: repository "betaThings" cannot store, filter or own workspaceId: the repository sets it']);
  });

  it('given dependents in a table that is neither the extension\'s nor a dependency\'s, fails the extension', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'thing')], { dependsOn: ['alpha'] });
    const gamma = withEntities('gamma', [entity('gamma', 'thing')]);
    const dependents = (table: string) => ({ ...repository('thing', 'betaThings', 'beta_thing'), dependents: [{ entity: 'x', table, column: 'thingId' }] });

    expect(summary([alpha, beta, gamma], {
      servers: [
        serverOf(alpha, [repository('thing', 'alphaThings', 'alpha_thing')]),
        serverOf(beta, [dependents('alpha_other')]),
        serverOf(gamma, [{ ...repository('thing', 'gammaThings', 'gamma_thing'), dependents: [{ entity: 'x', table: 'alpha_thing', column: 'thingId' }] }]),
      ],
    })).toEqual([
      'alpha active',
      'beta active',
      'gamma failed: repository "gammaThings" counts dependents in "alpha_thing", which is neither its table nor a dependency\'s',
    ]);
  });

  it('lists the repository definitions of the active extensions, in registry order', () => {
    const alpha = withEntities('alpha', [entity('alpha', 'thing')]);
    const beta = withEntities('beta', [entity('beta', 'thing')], { dependsOn: ['alpha'] });
    const registry = createExtensionRegistry([beta, alpha], {
      servers: [serverOf(beta, [repository('thing', 'betaThings', 'beta_thing')]), serverOf(alpha, [repository('thing', 'alphaThings', 'alpha_thing')])],
    });

    expect(registry.repositories().map(({ key }) => key)).toEqual(['alphaThings', 'betaThings']);
  });

  it('given dependents in a table of another extension whose id extends its own (vpn and vpn-x), fails the extension', () => {
    const vpnX = withEntities('vpn-x', [entity('vpn-x', 'peer', 'vpn_x_peer')]);
    const vpn = withEntities('vpn', [entity('vpn', 'peer')]);

    expect(summary([vpnX, vpn], {
      servers: [
        serverOf(vpnX, [repository('peer', 'vpnXPeers', 'vpn_x_peer')]),
        serverOf(vpn, [{ ...repository('peer', 'vpnPeers', 'vpn_peer'), dependents: [{ entity: 'x', table: 'vpn_x_peer', column: 'peerId' }] }]),
      ],
    })).toEqual([
      'vpn failed: repository "vpnPeers" counts dependents in "vpn_x_peer", which is neither its table nor a dependency\'s',
      'vpn-x active',
    ]);
  });

  it('given a manifest whose id is malformed, marks it failed instead of throwing, and keeps the others', () => {
    const bad = withEntities('bad(', [entity('bad(', 'peer', 'bad_peer')]);
    const vpn = manifest('vpn');

    const extensions = summary([bad, vpn]);

    expect(extensions).toHaveLength(2);
    expect(extensions[0]).toMatch(/^bad\( failed: .*id: /);
    expect(extensions[1]).toBe('vpn active');
  });
});

describe('extension registry: trace hop resolvers', () => {
  const resolver = { entity: 'peer', resolve: () => Promise.resolve([]) };
  /** An extension with server code, declaring the `peer` entity when asked to. */
  const extension = (id: string, { peer = false, dependsOn = [] as string[] } = {}) => {
    const base = manifest(id, { dependsOn, code: { server: true } });
    const entities = peer ? [{ id: 'peer', table: `${id}_peer`, label: `extensions.${id}.entities.peer` }] : [];
    return { ...base, contributes: { ...base.contributes, entities } } satisfies ExtensionManifest;
  };
  /** Its server code, resolving `peer` unless told not to, with the repository of the entity it declares. */
  const serverOf = (item: ExtensionManifest, { resolves = true } = {}) => defineExtensionServer(item, {
    ...(resolves ? { traceHopResolvers: [resolver] } : {}),
    repositories: (item.contributes.entities ?? []).map(({ id, table }) => defineEntityRepository({
      entity: id, key: `${item.id}Peers`, table, schema: { input: {}, patch: {} } as never, columns: [],
    })),
  });

  it('given two active extensions resolving the same entity, fails the second with a conflict naming the entity and keeps the first one\'s resolver', () => {
    const alpha = extension('alpha', { peer: true });
    const beta = extension('beta', { dependsOn: ['alpha'] });
    const servers = [serverOf(alpha), serverOf(beta)];

    const registry = createExtensionRegistry([alpha, beta], { servers });

    expect(summary([alpha, beta], { servers }))
      .toEqual(['alpha active', 'beta failed: resolves trace hops of "peer", which "alpha" already resolves']);
    expect(registry.traceHopResolvers()).toEqual([{ extension: 'alpha', resolver }]);
  });

  it('given a resolver for an entity neither its extension nor that extension\'s dependencies declare, fails the extension', () => {
    const alpha = extension('alpha', { peer: true });
    const gamma = extension('gamma');

    expect(summary([alpha, gamma], { servers: [serverOf(alpha, { resolves: false }), serverOf(gamma)] })).toEqual([
      'alpha active',
      'gamma failed: resolves trace hops of "peer", which neither it nor its dependencies declare',
    ]);
  });
});
