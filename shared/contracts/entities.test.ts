import { describe, expect, it } from 'vitest';

import { BUILTIN_ENTITY_CONTRACTS, entityContracts, entityOperationName } from './entities';
import { CONTRACTS } from './index';
import { TAGS } from './tags';
import { BUILTIN_EXTENSION_SERVERS, BUILTIN_EXTENSIONS } from '../../server/extensions/builtin';

import type { ExtensionManifest } from '@stackmap/extension-sdk';

const PATH = '/api/workspaces/:workspaceId/entities';

const builtinDefinitions = () => BUILTIN_EXTENSIONS.flatMap((manifest) => {
  const server = BUILTIN_EXTENSION_SERVERS.find((candidate) => candidate.extension === manifest.id);
  return (server?.repositories ?? []).map((definition) => ({ manifest, definition }));
});

const core = BUILTIN_EXTENSIONS.find(({ id }) => id === 'core') as ExtensionManifest;
const coreDefinition = (entity: string) => {
  const found = builtinDefinitions().find(({ definition }) => definition.entity === entity)?.definition;
  if (!found) {
    throw new Error(`No core definition for ${entity}`);
  }
  return found;
};

describe('entity contracts', () => {
  it('builds list, create, read, update and remove operations for every built-in repository definition (1)', () => {
    const expected = builtinDefinitions().flatMap(({ manifest, definition }) => {
      const base = `${PATH}/${manifest.id}/${definition.entity}`;
      return [`get ${base}`, `post ${base}`, `get ${base}/:entityId`, `patch ${base}/:entityId`, `delete ${base}/:entityId`];
    });

    expect(expected.length).toBeGreaterThan(0);
    expect(BUILTIN_ENTITY_CONTRACTS.map(({ method, path }) => `${method} ${path}`)).toEqual(expected);
  });

  it('gives each operation the entity\'s own schemas, a description, the extension\'s tag, examples and described fields (2)', () => {
    const host = coreDefinition('host');
    const { list, create, get, update, remove } = entityContracts(core, host);

    expect([list, create, get, update, remove].map(({ requiredRole }) => requiredRole))
      .toEqual(['viewer', 'editor', 'viewer', 'editor', 'editor']);
    for (const contract of [list, create, get, update, remove]) {
      expect(contract.description.trim(), contract.operationId).not.toBe('');
      expect(contract.tags, contract.operationId).toHaveLength(1);
      expect(Object.keys(TAGS), contract.operationId).toContain(contract.tags[0]);
    }
    expect(create.body?.safeParse({ name: 'nas', kind: 'physical' }).success).toBe(true);
    expect(create.body?.safeParse({ name: 'nas' }).success).toBe(false);
    expect(update.body?.safeParse({ os: 'Debian 13' }).success).toBe(true);
    expect(update.body?.safeParse({ id: '0199d6a0-0000-7000-8000-000000000001' }).success).toBe(false);
    expect(list.query?.safeParse({ siteId: '0199d6a0-0000-7000-8000-000000000001', limit: '10', offset: '20' }).success)
      .toBe(true);
    expect(list.query?.safeParse({ hostId: '0199d6a0-0000-7000-8000-000000000001' }).success).toBe(false);
    expect(Object.keys(create.responses).map(Number)).toEqual(expect.arrayContaining([201, 409, 422]));
    expect(Object.keys(update.responses).map(Number)).toEqual(expect.arrayContaining([200, 404, 409, 422]));
    expect(Object.keys(remove.responses).map(Number)).toEqual(expect.arrayContaining([204, 404, 409]));
  });

  it('builds no operations for an entity whose manifest declares it without a repository definition (9)', () => {
    const declared = BUILTIN_EXTENSIONS.flatMap((manifest) =>
      (manifest.contributes.entities ?? []).map(({ id }) => `${PATH}/${manifest.id}/${id}`));
    const defined = new Set(builtinDefinitions().map(({ manifest, definition }) => `${PATH}/${manifest.id}/${definition.entity}`));
    const withoutRepository = declared.filter((path) => !defined.has(path));

    expect(BUILTIN_ENTITY_CONTRACTS.filter(({ path }) => withoutRepository.some((prefix) => path.startsWith(prefix))))
      .toEqual([]);
  });

  it('names operations from the extension and entity in PascalCase, dashes included (listCoreDnsRecords, listReverseProxyRoutes)', () => {
    expect(entityOperationName('core', 'dns-record')).toBe('CoreDnsRecord');
    expect(entityOperationName('reverse-proxy', 'route')).toBe('ReverseProxyRoute');
    expect(BUILTIN_ENTITY_CONTRACTS.map(({ operationId }) => operationId)).toEqual(expect.arrayContaining([
      'listCoreDnsRecords', 'createCoreDnsRecord', 'getCoreDnsRecord', 'updateCoreDnsRecord', 'removeCoreDnsRecord',
      'listReverseProxyRoutes', 'listNatPortForwards',
    ]));
  });

  it('lists every entity operation of the built-in extensions in CONTRACTS', () => {
    expect(BUILTIN_ENTITY_CONTRACTS.length).toBeGreaterThan(0);
    expect(CONTRACTS).toEqual(expect.arrayContaining([...BUILTIN_ENTITY_CONTRACTS]));
  });
});
