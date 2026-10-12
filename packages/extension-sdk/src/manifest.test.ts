import { describe, expect, it } from 'vitest';

import { defineExtension, ExtensionManifestError } from './manifest';

import type { ExtensionManifestInput } from './manifest';

const minimal = (): ExtensionManifestInput => ({
  id: 'reverse-proxy',
  version: '1.2.0',
  apiVersion: 1,
  name: 'extensions.reverse-proxy.name',
  description: 'extensions.reverse-proxy.description',
});

const full = () => ({
  ...minimal(),
  icon: 'i-lucide-arrow-left-right',
  alwaysOn: false,
  dependsOn: ['tls'],
  contributes: {
    kinds: {
      service: [
        { id: 'reverse-proxy', label: 'extensions.reverse-proxy.kinds.service.reverseProxy', icon: 'i-lucide-shuffle' },
        { id: 'npm', label: 'extensions.reverse-proxy.kinds.service.npm', icon: '/extensions/reverse-proxy/npm.svg' },
      ],
      protocol: [{ id: 'websocket', label: 'extensions.reverse-proxy.kinds.protocol.websocket' }],
    },
  },
}) satisfies ExtensionManifestInput;

/** The problems of the manifest error thrown by `define`. */
const problemsOf = (define: () => unknown): readonly string[] => {
  try {
    define();
  } catch (error) {
    if (error instanceof ExtensionManifestError) {
      return error.problems;
    }
    throw error;
  }
  throw new Error('The manifest was accepted');
};

describe('defineExtension', () => {
  it('given a valid manifest, returns it typed with defaults: not always on, no dependencies, no kinds, no icon', () => {
    expect(defineExtension(minimal())).toEqual({
      ...minimal(),
      alwaysOn: false,
      dependsOn: [],
      contributes: { kinds: {} },
    });
    expect(defineExtension(full())).toEqual(full());
  });

  it('given an id that is not kebab-case or longer than 40 characters, fails naming id', () => {
    for (const id of ['My_Ext', 'reverse--proxy', '-proxy', `a${'-b'.repeat(20)}`]) {
      expect(problemsOf(() => defineExtension({ ...minimal(), id }))).toContainEqual(expect.stringMatching(/^id: /));
    }
  });

  it('given a version that is not semver, fails naming version', () => {
    for (const version of ['1.0', 'v1.0.0', 'latest']) {
      expect(problemsOf(() => defineExtension({ ...minimal(), version }))).toEqual([expect.stringMatching(/^version: /)]);
    }
  });

  it('given an unknown key, such as dependOn or contributes.kinds.router, fails naming the key', () => {
    expect(problemsOf(() => defineExtension({ ...minimal(), dependOn: ['tls'] } as ExtensionManifestInput)))
      .toEqual([expect.stringContaining('"dependOn"')]);
    expect(problemsOf(() => defineExtension({
      ...minimal(),
      contributes: { kinds: { router: [] } } as ExtensionManifestInput['contributes'],
    }))).toEqual([expect.stringMatching(/^contributes\.kinds: .*"router"/)]);
  });

  it('given a message key outside extensions.<id>., fails naming the key', () => {
    const problems = problemsOf(() => defineExtension({
      ...full(),
      name: 'app.name',
      contributes: { kinds: { host: [{ id: 'nas', label: 'extensions.storage.kinds.host.nas' }] } },
    }));

    expect(problems).toEqual([
      expect.stringMatching(/^name: .*extensions\.reverse-proxy\./),
      expect.stringMatching(/^contributes\.kinds\.host\.0\.label: .*extensions\.reverse-proxy\./),
    ]);
  });

  it('given an icon that is neither a Lucide name nor an image of the extension (or a remote URL), fails naming the path', () => {
    for (const icon of [
      'mdi-home',
      'i-mdi-home',
      'https://cdn.example/npm.svg',
      '//cdn.example/npm.svg',
      '/extensions/tls/npm.svg',
      '/extensions/reverse-proxy/npm.gif',
      '/extensions/reverse-proxy/../core/npm.svg',
    ]) {
      expect(problemsOf(() => defineExtension({ ...minimal(), icon } as ExtensionManifestInput)))
        .toEqual([expect.stringMatching(/^icon: /)]);
      expect(problemsOf(() => defineExtension({
        ...minimal(),
        contributes: { kinds: { service: [{ id: 'npm', label: 'extensions.reverse-proxy.npm', icon }] } },
      } as ExtensionManifestInput))).toEqual([expect.stringMatching(/^contributes\.kinds\.service\.0\.icon: /)]);
    }
  });

  it('given a kind id that is not kebab-case, or the same kind twice for one entity, fails naming the kind', () => {
    const label = 'extensions.reverse-proxy.kind';

    expect(problemsOf(() => defineExtension({
      ...minimal(),
      contributes: { kinds: { service: [{ id: 'Reverse_Proxy', label }] } },
    }))).toEqual([expect.stringMatching(/^contributes\.kinds\.service\.0\.id: /)]);
    expect(problemsOf(() => defineExtension({
      ...minimal(),
      contributes: { kinds: { host: [{ id: 'vm', label }, { id: 'vm', label }] } },
    }))).toEqual([expect.stringMatching(/^contributes\.kinds\.host\.1\.id: .*"vm"/)]);
  });

  it('fails with an ExtensionManifestError that names the extension and lists every problem with its path', () => {
    let error: unknown;
    try {
      defineExtension({ ...minimal(), version: 'latest', icon: 'mdi-home' as never });
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(ExtensionManifestError);
    expect(error).toMatchObject({
      extensionId: 'reverse-proxy',
      problems: [expect.stringMatching(/^version: /), expect.stringMatching(/^icon: /)],
      message: expect.stringMatching(/"reverse-proxy"[\s\S]*- version: [\s\S]*- icon: /) as string,
    });
  });
});
