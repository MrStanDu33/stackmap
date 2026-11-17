import { createHash } from 'node:crypto';

import { sql } from 'kysely';

import { inTransaction } from './entity-repository';
import { disabledExtensions } from './workspace-extensions';
import { normalizeSearchText, searchPatterns } from '../domain/search';

import type { WorkspaceRepositories } from './index';
import type { Database } from '../database/types/schema';
import type { RegisteredRepository } from '../extensions/registry';
import type { Kysely } from 'kysely';

/** An entity search found. */
export interface SearchHit {
  extension: string;
  entity: string;
  id: string;
  title: string;
  /** The search field whose value matched first, or `tags`. */
  matched: string;
}

type Indexed = Pick<RegisteredRepository, 'extension' | 'entity' | 'search'>;
type Repository = {
  get: (id: string) => Promise<Record<string, unknown> | undefined>;
  list: (filter: object, page: { limit: number; offset: number }) => Promise<Record<string, unknown>[]>;
};

const MAX_TITLE = 200;
/** Rows read per call while rebuilding. */
const PAGE = 1000;
// shortcut: matches are sorted in memory, at most this many; enough at homelab scale, rank in SQL if it grows.
const MAX_MATCHES = 2000;
const VERSION_KEY = 'searchIndexVersion';

/** The value of a search field: a column or owned field, or a field of an owned list's items (`addresses.address`). */
const valueOf = (entity: Record<string, unknown>, field: string): unknown => {
  const [name = '', item] = field.split('.');
  const value = entity[name];
  return item !== undefined && Array.isArray(value)
    ? value.map((element) => (element as Record<string, unknown> | null)?.[item])
    : value;
};

const textOf = (value: unknown): string => (Array.isArray(value)
  ? value.map(textOf).filter(Boolean).join(', ')
  : typeof value === 'string' || typeof value === 'number' ? String(value) : '');

const rowOf = (workspaceId: string, definition: Indexed, entity: Record<string, unknown>) => {
  const { extension, entity: type, search = [] } = definition;
  const id = String(entity.id);
  const [first] = search;
  const title = (first === undefined ? '' : textOf(valueOf(entity, first))) || id;
  return {
    workspaceId,
    extension,
    entity: type,
    entityId: id,
    title: title.slice(0, MAX_TITLE),
    text: normalizeSearchText([...search.map((field) => valueOf(entity, field)), entity.tags]),
  };
};

/** Writes the entity's row of the search index, replacing the one it had. */
export async function indexEntity(
  db: Kysely<Database>, workspaceId: string, definition: Indexed, entity: Record<string, unknown>,
): Promise<void> {
  const row = rowOf(workspaceId, definition, entity);
  await db.insertInto('search_index').values(row)
    .onConflict((conflict) => conflict.columns(['workspaceId', 'extension', 'entity', 'entityId'])
      .doUpdateSet({ title: row.title, text: row.text }))
    .execute();
}

/** Deletes the entity's row of the search index. */
export async function unindexEntity(
  db: Kysely<Database>, workspaceId: string, { extension, entity }: Indexed, id: string,
): Promise<void> {
  await db.deleteFrom('search_index').where('workspaceId', '=', workspaceId).where('extension', '=', extension)
    .where('entity', '=', entity).where('entityId', '=', id).execute();
}

/** The entities of the workspace whose text matches every word of the query, title prefix first. */
export async function searchEntities(
  { db, repos, workspaceId }: { db: Kysely<Database>; repos: WorkspaceRepositories; workspaceId: string },
  definitions: readonly RegisteredRepository[],
  { q, limit }: { q: string; limit: number },
): Promise<{ items: SearchHit[]; truncated: boolean }> {
  const patterns = searchPatterns(q);
  if (patterns.length === 0) {
    return { items: [], truncated: false };
  }
  const disabled = [...await disabledExtensions(db, workspaceId)];
  let query = db.selectFrom('search_index').select(['extension', 'entity', 'entityId', 'title', 'text'])
    .where('workspaceId', '=', workspaceId);
  if (disabled.length > 0) {
    query = query.where('extension', 'not in', disabled);
  }
  for (const pattern of patterns) {
    // The same escape on both databases: a backslash.
    query = query.where(sql<boolean>`${sql.ref('text')} like ${pattern} escape '\\'`);
  }
  const rows = await query.limit(MAX_MATCHES).execute();
  const words = normalizeSearchText([q]).split(' ');
  const prefix = normalizeSearchText([q]);
  const starts = (title: string) => normalizeSearchText([title]).startsWith(prefix);
  rows.sort((one, other) => Number(starts(other.title)) - Number(starts(one.title))
    || one.title.localeCompare(other.title, 'en'));

  const items: SearchHit[] = [];
  for (const row of rows) {
    const definition = definitions
      .find(({ extension, entity }) => extension === row.extension && entity === row.entity);
    // A failed extension has no repository: its entities cannot be read.
    const repository = definition && (repos as unknown as Record<string, Repository | undefined>)[definition.key];
    if (!definition || !repository) {
      continue;
    }
    const entity = await repository.get(row.entityId);
    if (!entity) {
      // Removed with another entity (a cascade): its row went unnoticed until now.
      await unindexEntity(db, workspaceId, definition, row.entityId);
      continue;
    }
    if (items.length === limit) {
      return { items, truncated: true };
    }
    const fields = [...(definition.search ?? []), 'tags'];
    const texts = fields.map((field) => normalizeSearchText([valueOf(entity, field)]));
    const index = texts.findIndex((text) => words.every((word) => text.includes(word)));
    const any = texts.findIndex((text) => words.some((word) => text.includes(word)));
    items.push({
      extension: row.extension,
      entity: row.entity,
      id: row.entityId,
      title: row.title,
      matched: fields[index >= 0 ? index : Math.max(any, 0)] ?? 'tags',
    });
  }
  return { items, truncated: false };
}

/** Identifies the definitions' search fields: the index is rebuilt when it changes. */
const versionOf = (definitions: readonly RegisteredRepository[]) => createHash('sha256')
  .update(definitions.map(({ extension, entity, search = [] }) => `${extension}/${entity}:${search.join(',')}`).sort().join('\n'))
  .digest('hex');

/** Rebuilds every workspace's index when the definitions' search fields changed since it was built; says whether. */
export async function refreshSearchIndex(
  db: Kysely<Database>,
  definitions: readonly RegisteredRepository[],
): Promise<boolean> {
  const reposOf = (_id: string): Promise<WorkspaceRepositories> => Promise.reject(new Error('Not implemented'));
  const version = versionOf(definitions);
  const stored = await db.selectFrom('appSetting').select('value').where('key', '=', VERSION_KEY).executeTakeFirst();
  if (stored?.value === JSON.stringify(version)) {
    return false;
  }
  const workspaces = await db.selectFrom('workspace').select('id').execute();
  for (const { id: workspaceId } of workspaces) {
    const repos = await reposOf(workspaceId) as unknown as Record<string, Repository | undefined>;
    const rows: ReturnType<typeof rowOf>[] = [];
    for (const definition of definitions) {
      const repository = repos[definition.key];
      for (let offset = 0; repository; offset += PAGE) {
        const page = await repository.list({}, { limit: PAGE, offset });
        rows.push(...page.map((entity) => rowOf(workspaceId, definition, entity)));
        if (page.length < PAGE) {
          break;
        }
      }
    }
    await inTransaction(db, async (trx) => {
      await trx.deleteFrom('search_index').where('workspaceId', '=', workspaceId).execute();
      for (let start = 0; start < rows.length; start += PAGE) {
        await trx.insertInto('search_index').values(rows.slice(start, start + PAGE)).execute();
      }
    });
  }
  const now = new Date().toISOString();
  await db.insertInto('appSetting').values({ key: VERSION_KEY, value: JSON.stringify(version), updatedAt: now })
    .onConflict((conflict) => conflict.column('key').doUpdateSet({ value: JSON.stringify(version), updatedAt: now }))
    .execute();
  return true;
}
