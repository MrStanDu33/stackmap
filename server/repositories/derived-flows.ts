import { flowDraftSchema, MAX_FLOW_DRAFTS } from '@stackmap/extension-sdk/server';
import { sql } from 'kysely';
import { z } from 'zod';

import { newId } from '../database/ids';
import { fromBoolean, fromJson, toBoolean, toJson } from '../database/serialize';

import type { Database, DerivedFlowTable } from '../database/types/schema';
import type { RegisteredFlowDeriver } from '../extensions/registry';
import type { ExtensionLogger } from '@stackmap/extension-sdk';
import type { FlowBasis, FlowClient, FlowDeriver, FlowDraft, FlowReader } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** A flow a deriver produced, as stored: rewritten by every refresh, never edited. */
export interface DerivedFlow {
  id: string;
  extension: string;
  deriver: string;
  key: string;
  sourceServiceId: string | null;
  sourceClient: FlowClient | null;
  targetListenerId: string;
  protocol: string | null;
  encrypted: boolean | null;
  hostnames: string[];
  basis: FlowBasis[];
}

export const DERIVER_TIMEOUT_MS = 5000;

const COLUMNS = [
  'id', 'extension', 'deriver', 'key', 'sourceServiceId', 'sourceClient', 'targetListenerId', 'protocol', 'encrypted',
  'hostnames', 'basis',
] as const;

type Row = Omit<DerivedFlowTable, 'workspaceId'>;

const fromRow = (row: Row): DerivedFlow => ({
  ...row,
  sourceClient: row.sourceClient as FlowClient | null,
  encrypted: row.encrypted === null ? null : fromBoolean(row.encrypted, 'derived_flow.encrypted'),
  hostnames: fromJson(row.hostnames, 'derived_flow.hostnames') as string[],
  basis: fromJson(row.basis, 'derived_flow.basis') as FlowBasis[],
});

/** The workspace's derived flows, by extension, deriver and key. */
export async function listDerivedFlows(db: Kysely<Database>, workspaceId: string): Promise<DerivedFlow[]> {
  const rows = await db.selectFrom('derived_flow').select(COLUMNS).where('workspaceId', '=', workspaceId)
    .orderBy('extension').orderBy('deriver').orderBy('key').execute();
  return rows.map(fromRow);
}

export interface RefreshOptions {
  derivers: readonly RegisteredFlowDeriver[];
  read: FlowReader;
  logger: (extension: string) => ExtensionLogger;
  timeoutMs?: number;
}

class DeriverTimeoutError extends Error {
  override name = 'DeriverTimeoutError';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DeriverTimeoutError(`timed out after ${String(timeoutMs)} ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

const toRow = (extension: string, deriver: string, draft: FlowDraft): Omit<Row, 'id'> => ({
  extension,
  deriver,
  key: draft.key,
  sourceServiceId: 'serviceId' in draft.source ? draft.source.serviceId : null,
  sourceClient: 'client' in draft.source ? draft.source.client : null,
  targetListenerId: draft.targetListenerId,
  protocol: draft.protocol ?? null,
  encrypted: draft.encrypted === undefined || draft.encrypted === null ? null : toBoolean(draft.encrypted),
  hostnames: toJson(draft.hostnames ?? []),
  basis: toJson(draft.basis),
});

const identity = ({ extension, deriver, key }: Pick<Row, 'extension' | 'deriver' | 'key'>) =>
  JSON.stringify([extension, deriver, key]);

/** How many rows one statement writes or deletes, well under both databases' limits on bound parameters. */
const BATCH = 500;

const batches = <T>(items: readonly T[]): T[][] => Array.from(
  { length: Math.ceil(items.length / BATCH) },
  (_, index) => items.slice(index * BATCH, (index + 1) * BATCH),
);

/** A deriver's own reader: frozen, refusing reads once its run is over, so a late read cannot touch the transaction. */
function readerFor(read: FlowReader, deriver: string, ended: { reason?: string }): FlowReader {
  type Read = (...args: unknown[]) => Promise<unknown>;
  const guard = (call: Read): Read => (...args) => (ended.reason === undefined
    ? call(...args)
    : Promise.reject(new Error(`flow deriver "${deriver}" ${ended.reason}: its reads are refused`)));
  const repositories = Object.entries(read as unknown as Record<string, { get: Read; list: Read }>);
  return Object.freeze(Object.fromEntries(repositories.map(([key, { get, list }]) =>
    [key, Object.freeze({ get: guard(get), list: guard(list) })]))) as unknown as FlowReader;
}

/**
 * Runs one deriver in a savepoint, so that a query of its that fails leaves the transaction usable, and returns its
 * valid drafts, or undefined when it failed as a whole.
 */
async function runDeriver(
  db: Kysely<Database>,
  run: { deriver: FlowDeriver; read: FlowReader; log: ExtensionLogger; timeoutMs: number },
): Promise<FlowDraft[] | undefined> {
  const { deriver, read, log, timeoutMs } = run;
  const ended: { reason?: string } = {};
  await sql`savepoint flow_deriver`.execute(db);
  try {
    const result = await withTimeout(deriver.derive({ read: readerFor(read, deriver.id, ended) }), timeoutMs);
    ended.reason = 'finished';
    await sql`release savepoint flow_deriver`.execute(db);
    const list = resultSchema.safeParse(result);
    if (!list.success) {
      log.error(`flow deriver "${deriver.id}" returned an invalid result: `
        + `${String(list.error.issues.length)} issues, at ${list.error.issues.slice(0, 5).map(pathOf).join(', ')}`);
      return undefined;
    }
    return validDrafts(list.data, deriver.id, log);
  } catch (error) {
    ended.reason ??= error instanceof DeriverTimeoutError ? 'timed out' : 'failed';
    await sql`rollback to savepoint flow_deriver`.execute(db);
    log.error(`flow deriver "${deriver.id}" failed: ${error instanceof Error ? error.message : String(error)}`, error);
    return undefined;
  }
}

/** The whole result: a list, bounded; its drafts are checked one by one. */
const resultSchema = z.array(z.unknown()).max(MAX_FLOW_DRAFTS);

const pathOf = ({ path }: { path: PropertyKey[] }) => path.map(String).join('.') || '(result)';

/** The drafts that are valid and not keyed like an earlier one; the others are logged by position, never by key. */
function validDrafts(items: readonly unknown[], deriver: string, log: ExtensionLogger): FlowDraft[] {
  const keys = new Set<string>();
  return items.flatMap((item, index) => {
    const draft = flowDraftSchema.safeParse(item);
    if (!draft.success) {
      log.warn(`flow deriver "${deriver}" returned an invalid draft ${String(index)}, at `
        + `${draft.error.issues.slice(0, 5).map(pathOf).join(', ')}: dropped`);
      return [];
    }
    if (keys.has(draft.data.key)) {
      log.warn(`flow deriver "${deriver}" returned draft ${String(index)} with an earlier draft's key: dropped`);
      return [];
    }
    keys.add(draft.data.key);
    return [draft.data];
  });
}

/**
 * Runs the derivers and rewrites the workspace's derived flows to match, keeping the id of a flow whose key stays.
 * A deriver that fails keeps its stored flows; an invalid draft, or one whose source or target is not in the
 * workspace, is dropped. Runs in the caller's transaction, after its writes.
 */
export async function refreshDerivedFlows(
  db: Kysely<Database>,
  workspaceId: string,
  { derivers, read, logger, timeoutMs = DERIVER_TIMEOUT_MS }: RefreshOptions,
): Promise<void> {
  // shortcut: every write re-derives the whole workspace; derive only the affected derivers when that shows.
  const [services, listeners, stored] = await Promise.all([
    read.services.list(), read.listeners.list(),
    db.selectFrom('derived_flow').select(COLUMNS).where('workspaceId', '=', workspaceId).execute(),
  ]);
  const serviceIds = new Set(services.map(({ id }) => id));
  const listenerIds = new Set(listeners.map(({ id }) => id));
  const wanted = new Map<string, Omit<Row, 'id'>>();
  const refreshed = new Set<string>();

  for (const { extension, deriver } of derivers) {
    const log = logger(extension);
    const drafts = await runDeriver(db, { deriver, read, log, timeoutMs });
    if (drafts === undefined) {
      continue;
    }
    refreshed.add(JSON.stringify([extension, deriver.id]));
    drafts.forEach((draft, index) => {
      const source = 'serviceId' in draft.source ? draft.source.serviceId : undefined;
      if (!listenerIds.has(draft.targetListenerId) || (source !== undefined && !serviceIds.has(source))) {
        log.warn(`flow deriver "${deriver.id}" returned draft ${String(index)}, whose source or target is not in the `
          + 'workspace: dropped');
        return;
      }
      const row = toRow(extension, deriver.id, draft);
      wanted.set(identity(row), row);
    });
  }

  const kept = new Set<string>();
  const gone: string[] = [];
  for (const row of stored) {
    if (!refreshed.has(JSON.stringify([row.extension, row.deriver]))) {
      continue;
    }
    const next = wanted.get(identity(row));
    if (next === undefined) {
      gone.push(row.id);
      continue;
    }
    kept.add(identity(row));
    if (JSON.stringify({ ...row, id: undefined }) !== JSON.stringify({ ...next, id: undefined })) {
      await db.updateTable('derived_flow').set(next).where('workspaceId', '=', workspaceId).where('id', '=', row.id)
        .execute();
    }
  }
  for (const ids of batches(gone)) {
    await db.deleteFrom('derived_flow').where('workspaceId', '=', workspaceId).where('id', 'in', ids).execute();
  }
  const added = [...wanted].filter(([identityOf]) => !kept.has(identityOf))
    .map(([, row]) => ({ ...row, id: newId(), workspaceId }));
  for (const rows of batches(added)) {
    await db.insertInto('derived_flow').values(rows).execute();
  }
}
