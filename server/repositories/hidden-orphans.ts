import { listDerivedFlows } from './derived-flows';
import { toTimestamp } from '../database/serialize';

import type { WorkspaceRepositories } from './index';
import type { Database } from '../database/types/schema';
import type { RegisteredRepository } from '../extensions/registry';
import type { Kysely } from 'kysely';

/** Most orphans listed per entity type. */
export const MAX_ORPHANS = 200;

/** Rows read per call while looking for orphans. */
const PAGE = 1000;

type Value = string | number | boolean | null | string[];

/** A hidden entity no flow is based on, as the entity API sends it. */
export interface HiddenOrphan {
  entity: string;
  id: string;
  fields: Record<string, Value>;
}

export interface OrphanWorkspace {
  db: Kysely<Database>;
  repos: WorkspaceRepositories;
  workspaceId: string;
}

type Lister = { list: (filter: object, page: { limit: number; offset: number }) => Promise<Record<string, unknown>[]> };

const key = (entity: string, id: string) => `${entity}:${id}`;

/** The fields of an entity as the entity API sends them, limited to what the contract types: enough to name it. */
const fieldsOf = ({ workspaceId: _workspaceId, ...entity }: Record<string, unknown>): Record<string, Value> =>
  Object.fromEntries(Object.entries(entity).flatMap(([field, value]): [string, Value][] => {
    if (value instanceof Date) {
      return [[field, value.toISOString()]];
    }
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      return [[field, value as Value]];
    }
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? [[field, value]] : [];
  }));

/** The entity type keys some stored derived flow of the workspace is based on. */
async function connectedKeys(db: Kysely<Database>, workspaceId: string): Promise<Set<string>> {
  const flows = await listDerivedFlows(db, workspaceId);
  return new Set(flows.flatMap(({ basis }) => basis.map(({ entity, id }) => key(entity, id))));
}

/**
 * The entities of an extension (its repository definitions) that no stored derived flow of the workspace is based
 * on, less those kept hidden; at most MAX_ORPHANS per type, `truncated` when there were more.
 */
export async function listHiddenOrphans(
  { db, repos, workspaceId }: OrphanWorkspace,
  definitions: readonly RegisteredRepository[],
): Promise<{ items: HiddenOrphan[]; truncated: boolean }> {
  const extensions = [...new Set(definitions.map(({ extension }) => extension))];
  const [connected, kept] = await Promise.all([
    connectedKeys(db, workspaceId),
    extensions.length === 0
      ? []
      : db.selectFrom('workspace_hidden_entity_kept').select(['entity', 'entityId'])
          .where('workspaceId', '=', workspaceId).where('extension', 'in', extensions).execute(),
  ]);
  const skipped = new Set([...connected, ...kept.map(({ entity, entityId }) => key(entity, entityId))]);
  const items: HiddenOrphan[] = [];
  let truncated = false;
  for (const { key: repository, entity } of definitions) {
    const lister = (repos as unknown as Record<string, Lister>)[repository] as Lister;
    const found: HiddenOrphan[] = [];
    // Pages until one more orphan than shown is found: that one says the list is cut.
    for (let offset = 0; found.length <= MAX_ORPHANS; offset += PAGE) {
      const rows = await lister.list({}, { limit: PAGE, offset });
      found.push(...rows.filter(({ id }) => !skipped.has(key(entity, String(id))))
        .map((row) => ({ entity, id: String(row.id), fields: fieldsOf(row) })));
      if (rows.length < PAGE) {
        break;
      }
    }
    truncated ||= found.length > MAX_ORPHANS;
    items.push(...found.slice(0, MAX_ORPHANS));
  }
  return { items, truncated };
}

/** Whether a stored derived flow of the workspace is based on the entity. */
export async function isConnected(
  db: Kysely<Database>, workspaceId: string, entity: string, id: string,
): Promise<boolean> {
  return (await connectedKeys(db, workspaceId)).has(key(entity, id));
}

/** Keeps a hidden entity hidden: it leaves the orphans; marking it again changes nothing. */
export async function keepHiddenEntity(
  db: Kysely<Database>,
  workspaceId: string,
  { extension, entity, id }: { extension: string; entity: string; id: string },
  actorId: string | null,
): Promise<void> {
  await db.insertInto('workspace_hidden_entity_kept')
    .values((expression) => ({
      workspaceId,
      extension,
      entity,
      entityId: id,
      keptAt: toTimestamp(new Date()),
      // Null unless the actor is an account, as for audit events.
      keptBy: actorId === null ? null : expression.selectFrom('user').select('id').where('id', '=', actorId),
    }))
    .onConflict((conflict) => conflict.columns(['workspaceId', 'extension', 'entity', 'entityId']).doNothing())
    .execute();
}
