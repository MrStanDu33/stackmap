import { createDomain, createHost, createService } from '@stackmap/extension-core/testing';
import { describe, expect, it } from 'vitest';

import { indexEntity, refreshSearchIndex, searchEntities } from './search-index';
import { setExtensionsEnabled } from './workspace-extensions';
import { DIALECTS } from '../../tests/support/databases';
import { createPortForwards } from '../../tests/support/nat';
import { BUILTIN_REGISTRY, useTestWorkspaces } from '../../tests/support/workspaces';

import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

const definitions = BUILTIN_REGISTRY.repositories();

describe.each(DIALECTS)('search index on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const rows = (workspaceId = workspaces.a.workspace.id) => db().selectFrom('search_index')
    .select(['extension', 'entity', 'entityId', 'title', 'text'])
    .where('workspaceId', '=', workspaceId).orderBy('title').execute();

  it('given a host created through its repository, indexes its type, id, title and normalized name, addresses and tags (4, 6)', async () => {
    const host = await createHost(workspaces.a.repos, {
      name: 'Édge Router', addresses: [{ address: '203.0.113.10' }], tags: ['Edge', 'wan'],
    });

    expect(await rows()).toEqual([{
      extension: 'core', entity: 'host', entityId: host.id, title: 'Édge Router', text: 'edge router 203.0.113.10 edge wan',
    }]);
  });

  it('given an entity whose search fields are empty, indexes its tags, with its id as its title (edge case)', async () => {
    const id = '0199d6a0-0000-7000-8000-000000000099';

    await indexEntity(db(), workspaces.a.workspace.id, { extension: 'core', entity: 'host', search: ['name'] }, { id, name: null, tags: ['Lab'] });

    expect(await rows()).toEqual([{ extension: 'core', entity: 'host', entityId: id, title: id, text: 'lab' }]);
  });

  it('given an entity updated, rewrites its row; given it removed, deletes its row (5)', async () => {
    const host = await createHost(workspaces.a.repos, { name: 'Web server' });

    await workspaces.a.repos.hosts.update(host.id, { name: 'App server' });
    expect(await rows()).toEqual([expect.objectContaining({ entityId: host.id, title: 'App server', text: 'app server' })]);

    await workspaces.a.repos.hosts.remove(host.id);
    expect(await rows()).toEqual([]);
  });

  it('given a write that fails, leaves the index unchanged (5)', async () => {
    await createDomain(workspaces.a.repos, { name: 'homelab.example' });

    await expect(createDomain(workspaces.a.repos, { name: 'homelab.example' })).rejects.toThrow();
    expect(await rows()).toHaveLength(1);
  });

  it('given a workspace removed, its rows go with it (7)', async () => {
    await createHost(workspaces.b.repos, { name: 'Backup server' });
    expect(await rows(workspaces.b.workspace.id)).toHaveLength(1);

    await db().deleteFrom('workspace').where('id', '=', workspaces.b.workspace.id).execute();

    expect(await rows(workspaces.b.workspace.id)).toEqual([]);
  });

  it('given entities indexed under other search fields, or none, rebuilds every workspace\'s index and records the version (8)', async () => {
    const host = await createHost(workspaces.a.repos, { name: 'Edge router' });
    await createService(workspaces.b.repos, { name: 'Website', hostId: (await createHost(workspaces.b.repos, { name: 'Web server' })).id });
    await db().deleteFrom('search_index').execute();
    await db().insertInto('search_index').values({
      workspaceId: workspaces.a.workspace.id, extension: 'core', entity: 'host', entityId: host.id, title: 'stale', text: 'stale',
    }).execute();

    expect(await refreshSearchIndex(db(), definitions, (id) => workspaces.repositories(id))).toBe(true);

    expect((await rows()).map(({ title }) => title)).toEqual(['Edge router']);
    expect((await rows(workspaces.b.workspace.id)).map(({ title }) => title)).toEqual(['Web server', 'Website']);
    expect(await db().selectFrom('appSetting').select('key').where('key', '=', 'searchIndexVersion').executeTakeFirst())
      .toBeDefined();
  });

  it('given the index up to date with the definitions, rebuilds nothing (8)', async () => {
    const reposOf = (id: string) => workspaces.repositories(id);
    await refreshSearchIndex(db(), definitions, reposOf);
    await db().insertInto('search_index').values({
      workspaceId: workspaces.a.workspace.id, extension: 'core', entity: 'host', entityId: 'kept', title: 'kept', text: 'kept',
    }).execute();

    expect(await refreshSearchIndex(db(), definitions, reposOf)).toBe(false);
    expect((await rows()).map(({ title }) => title)).toEqual(['kept']);
  });
});

describe.each(DIALECTS)('searchEntities on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect);
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const search = (q: string, limit = 20, { repos, workspace } = workspaces.a) =>
    searchEntities({ db: db(), repos, workspaceId: workspace.id }, definitions, { q, limit });
  const titles = async (q: string, limit?: number) => (await search(q, limit)).items.map(({ title }) => title);

  it('given "router", finds every entity whose text contains it, saying which field matched (9)', async () => {
    const router = await createHost(workspaces.a.repos, { name: 'Edge router', addresses: [{ address: '203.0.113.10' }] });
    await createHost(workspaces.a.repos, { name: 'Web server', tags: ['router-lab'] });
    await createHost(workspaces.a.repos, { name: 'Database server' });

    expect((await search('router')).items).toEqual([
      { extension: 'core', entity: 'host', id: router.id, title: 'Edge router', matched: 'name' },
      expect.objectContaining({ title: 'Web server', matched: 'tags' }),
    ]);
    expect((await search('203.0.113')).items).toEqual([expect.objectContaining({ title: 'Edge router', matched: 'addresses.address' })]);
  });

  it('given "edge rou", finds only entities matching every word, in any order (9)', async () => {
    await createHost(workspaces.a.repos, { name: 'Edge router' });
    await createHost(workspaces.a.repos, { name: 'Edge switch' });

    expect(await titles('edge rou')).toEqual(['Edge router']);
    expect(await titles('rou edge')).toEqual(['Edge router']);
  });

  it('given "Édge", matches "edge" (10)', async () => {
    await createHost(workspaces.a.repos, { name: 'Edge router' });

    expect(await titles('ÉDGE')).toEqual(['Edge router']);
  });

  it('given "%", "_" or "\\", matches them as themselves (11)', async () => {
    await createHost(workspaces.a.repos, { name: 'web_1' });
    await createHost(workspaces.a.repos, { name: 'web-2' });
    await createHost(workspaces.a.repos, { name: '100% up' });

    expect(await titles('web_')).toEqual(['web_1']);
    expect(await titles('%')).toEqual(['100% up']);
    expect(await titles('\\')).toEqual([]);
  });

  it('lists titles starting with the query first, then the others, each by title, at most limit (12)', async () => {
    for (const name of ['Proxy two', 'Main proxy', 'Proxy one', 'Edge proxy']) {
      await createHost(workspaces.a.repos, { name });
    }

    expect(await titles('proxy')).toEqual(['Proxy one', 'Proxy two', 'Edge proxy', 'Main proxy']);
    expect(await search('proxy', 3)).toMatchObject({ truncated: true, items: [{ title: 'Proxy one' }, { title: 'Proxy two' }, { title: 'Edge proxy' }] });
  });

  it('leaves out entities of an extension turned off in the workspace (13)', async () => {
    await createPortForwards(workspaces.a.repos);
    await setExtensionsEnabled(db(), workspaces.a.workspace.id, ['nat'], false, null);

    expect((await search('203.0.113.10')).items.map(({ entity }) => entity)).toEqual(['host']);
  });

  it('leaves out a row whose entity no longer exists, and deletes it (14)', async () => {
    const { router } = await createPortForwards(workspaces.a.repos);
    await db().deleteFrom('core_host' as never).where('id' as never, '=', router.id as never).execute();

    expect((await search('203.0.113.10')).items).toEqual([]);
    expect(await db().selectFrom('search_index').select('entityId').where('text', 'like', '%203.0.113.10%').execute()).toEqual([]);
  });

  it('never returns another workspace\'s entities (15)', async () => {
    await createHost(workspaces.b.repos, { name: 'Edge router' });

    expect((await search('router')).items).toEqual([]);
    expect((await search('router', 20, workspaces.b)).items).toHaveLength(1);
  });
});
