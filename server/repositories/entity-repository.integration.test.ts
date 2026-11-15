import { createDomain, createHost, createService, createSite } from '@stackmap/extension-core/testing';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

import { listAuditEvents } from './audit-events';
import { EntityConflictError, EntityInUseError, EntityValidationError, WorkspaceReferenceError } from './errors';
import { createWorkspaceRepositories } from './index';
import { DIALECTS } from '../../tests/support/databases';
import { ACTOR, BUILTIN_KINDS, BUILTIN_REGISTRY, useTestWorkspaces } from '../../tests/support/workspaces';

import type { WorkspaceRepositories } from './index';
import type { Dialect } from '../../tests/support/databases';
import type { Database } from '../database/types/schema';
import type { CoreDatabase } from '@stackmap/extension-core/server/types';
import type { EntityRepositoryDefinition } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** The repositories with the host definition changed, as a definition with a race in it would behave. */
const withHosts = (
  db: Kysely<Database>,
  workspaceId: string,
  change: (definition: EntityRepositoryDefinition) => Partial<EntityRepositoryDefinition>,
): WorkspaceRepositories => createWorkspaceRepositories(BUILTIN_REGISTRY.repositories()
  .map((definition) => (definition.key === 'hosts' ? { ...definition, ...change(definition) } : definition)))(
  db, { workspaceId, actorId: ACTOR, kinds: BUILTIN_KINDS },
);

const failureOf = async (write: Promise<unknown>): Promise<unknown> => write.then(
  () => { throw new Error('Expected the write to fail'); },
  (error: unknown) => error,
);

describe.each(DIALECTS)('entity repository on %s', (dialect: Dialect) => {
  const workspaces = useTestWorkspaces(dialect, { actorAccount: true });
  const db = () => workspaces.db as unknown as Kysely<Database>;
  const events = () => listAuditEvents(db(), workspaces.a.workspace.id);

  describe('pages', () => {
    it('lists one page in creation order and counts every entity matching the filter (11)', async () => {
      const { repos } = workspaces.a;
      const site = await createSite(repos);
      const hosts = [];
      for (let index = 0; index < 5; index += 1) {
        hosts.push(await createHost(repos, { name: `host-${String(index)}`, siteId: index < 4 ? site.id : null }));
      }
      await createHost(workspaces.b.repos, { name: 'elsewhere' });

      const page = await repos.hosts.list({ siteId: site.id }, { limit: 2, offset: 1 });

      expect(page.map(({ name }) => name)).toEqual(['host-1', 'host-2']);
      expect(await repos.hosts.count({ siteId: site.id })).toBe(4);
      expect(await repos.hosts.count()).toBe(5);
      expect(await repos.hosts.list({}, { limit: 10, offset: 10 })).toEqual([]);
    });

    it('lists everything when no page is given, as before', async () => {
      const { repos } = workspaces.a;
      for (let index = 0; index < 3; index += 1) {
        await createSite(repos, { name: `site-${String(index)}` });
      }

      expect((await repos.sites.list()).map(({ name }) => name)).toEqual(['site-0', 'site-1', 'site-2']);
    });
  });

  describe('foreign key race', () => {
    it('turns a foreign key failure on create into a reference error naming the field when the re-check finds it (23)', async () => {
      const { workspace, repos } = workspaces.a;
      const site = await createSite(repos);
      // The site goes after the reference check passed, as if another request removed it meanwhile.
      const racing = withHosts(db(), workspace.id, (definition) => ({
        check: async (context, fields, changed, id) => {
          // On the write's own transaction: another connection would wait for its lock.
          await (context.db as unknown as Kysely<CoreDatabase>).deleteFrom('core_site').where('id', '=', site.id).execute();
          return definition.check?.(context, fields, changed, id) ?? [];
        },
      }));

      const error = await failureOf(racing.hosts.create({ name: 'nas', kind: 'physical', siteId: site.id }));

      expect(error).toBeInstanceOf(WorkspaceReferenceError);
      expect(error).toMatchObject({ field: 'siteId', id: site.id });
      expect(await repos.hosts.list()).toEqual([]);
    });

    it('turns a foreign key failure on update into a reference error, without a field when the re-check finds none (23)', async () => {
      const { workspace, repos } = workspaces.a;
      const host = await createHost(repos);
      const missing = '0199d6a0-0000-7000-8000-00000000dead';
      // A definition that forgot to declare the reference: only the database refuses it.
      const unchecked = withHosts(db(), workspace.id, () => ({ references: () => [] }));

      const error = await failureOf(unchecked.hosts.update(host.id, { siteId: missing }));

      expect(error).toBeInstanceOf(WorkspaceReferenceError);
      expect((error as { field: string | null }).field).toBeNull();
      expect(await repos.hosts.get(host.id)).toMatchObject({ siteId: null });
    });
  });

  describe('audit', () => {
    it('writes one event with the given fields when an entity is created (28)', async () => {
      const site = await createSite(workspaces.a.repos, { name: 'Home' });

      expect(await events()).toEqual([{
        id: expect.any(String) as string,
        actorId: ACTOR,
        action: 'create',
        extension: 'core',
        entity: 'site',
        entityId: site.id,
        fields: expect.arrayContaining(['name', 'status', 'tags', 'notes']) as string[],
        createdAt: expect.any(Date) as Date,
      }]);
    });

    it('writes one event with only the changed fields when an entity is updated (28)', async () => {
      const { repos } = workspaces.a;
      const host = await createHost(repos, { name: 'nas', os: null });

      await repos.hosts.update(host.id, { name: 'nas', os: 'Debian 13', notes: 'Under the desk' });

      const [latest] = await events();
      expect(latest).toMatchObject({ action: 'update', entity: 'host', entityId: host.id });
      expect(latest?.fields.toSorted()).toEqual(['notes', 'os']);
    });

    it('writes one event without fields when an entity is removed (28)', async () => {
      const { repos } = workspaces.a;
      const site = await createSite(repos);

      await repos.sites.remove(site.id);

      const [latest] = await events();
      expect(latest).toMatchObject({ action: 'delete', entity: 'site', entityId: site.id, fields: [] });
    });

    it('never stores field values (28)', async () => {
      const { repos } = workspaces.a;
      const host = await createHost(repos, { name: 'secret-vault', os: 'Hidden OS' });
      await repos.hosts.update(host.id, { notes: 'root password is on the sticky note' });

      const { rows } = await sql<Record<string, unknown>>`select * from ${sql.table('audit_event')}`.execute(db());

      expect(JSON.stringify(rows)).not.toMatch(/secret-vault|Hidden OS|sticky note/);
    });

    it('writes no event when the write fails: validation, conflict, in use or race (29)', async () => {
      const { repos } = workspaces.a;
      await createDomain(repos, { name: 'homelab.example' });
      const host = await createHost(repos);
      await createService(repos, { hostId: host.id });
      const before = (await events()).length;

      await expect(repos.sites.create({ name: '' })).rejects.toBeInstanceOf(EntityValidationError);
      await expect(createDomain(repos, { name: 'homelab.example' })).rejects.toBeInstanceOf(EntityConflictError);
      await expect(repos.hosts.remove(host.id)).rejects.toBeInstanceOf(EntityInUseError);
      await expect(repos.hosts.create({ name: 'nas', kind: 'physical', siteId: '0199d6a0-0000-7000-8000-00000000dead' }))
        .rejects.toBeInstanceOf(WorkspaceReferenceError);

      expect(await events()).toHaveLength(before);
    });

    it('writes no event and keeps updatedAt when an update changes nothing (30)', async () => {
      const { repos } = workspaces.a;
      const host = await createHost(repos, { name: 'nas' });
      const before = (await events()).length;

      const updated = await repos.hosts.update(host.id, { name: 'nas' });

      expect(updated?.updatedAt).toEqual(host.updatedAt);
      expect(await events()).toHaveLength(before);
    });

    it('writes the event with a null actor when the scope has none (31)', async () => {
      const system = workspaces.repositories(workspaces.a.workspace.id, { actorId: null });

      await createSite(system);

      expect(await events()).toMatchObject([{ actorId: null, action: 'create' }]);
    });

    it('names an owned field such as addresses once', async () => {
      const { repos } = workspaces.a;
      const host = await createHost(repos);

      await repos.hosts.update(host.id, { addresses: [{ address: '192.0.2.10' }, { address: '192.0.2.11' }] });

      const [latest] = await events();
      expect(latest?.fields).toEqual(['addresses']);
    });
  });
});
