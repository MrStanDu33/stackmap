import { flowDraftsSchema } from '@stackmap/extension-sdk/server';

import { newId } from '../database/ids';
import { fromBoolean, fromJson, toBoolean, toJson } from '../database/serialize';

import type { Database, DerivedFlowTable } from '../database/types/schema';
import type { RegisteredFlowDeriver } from '../extensions/registry';
import type { ExtensionLogger } from '@stackmap/extension-sdk';
import type { FlowBasis, FlowClient, FlowDraft, FlowReader } from '@stackmap/extension-sdk/server';
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${String(timeoutMs)} ms`));
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

/**
 * Runs the derivers and rewrites the workspace's derived flows to match, keeping the id of a flow whose key stays.
 * A deriver that fails keeps its stored flows; a draft whose source or target is not in the workspace is dropped.
 * Runs in the caller's transaction, after its writes.
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
    let drafts: FlowDraft[];
    try {
      const result = flowDraftsSchema.safeParse(await withTimeout(deriver.derive({ read }), timeoutMs));
      if (!result.success) {
        log.error(`flow deriver "${deriver.id}" returned an invalid result: ${result.error.message}`);
        continue;
      }
      drafts = result.data;
    } catch (error) {
      log.error(`flow deriver "${deriver.id}" failed: ${error instanceof Error ? error.message : String(error)}`, error);
      continue;
    }
    refreshed.add(JSON.stringify([extension, deriver.id]));
    for (const draft of drafts) {
      const source = 'serviceId' in draft.source ? draft.source.serviceId : undefined;
      if (!listenerIds.has(draft.targetListenerId) || (source !== undefined && !serviceIds.has(source))) {
        log.warn(`flow deriver "${deriver.id}" returned flow "${draft.key}" whose source or target is not in the workspace: dropped`);
        continue;
      }
      const row = toRow(extension, deriver.id, draft);
      wanted.set(identity(row), row);
    }
  }

  const kept = new Set<string>();
  for (const row of stored) {
    if (!refreshed.has(JSON.stringify([row.extension, row.deriver]))) {
      continue;
    }
    const next = wanted.get(identity(row));
    if (next === undefined) {
      await db.deleteFrom('derived_flow').where('workspaceId', '=', workspaceId).where('id', '=', row.id).execute();
      continue;
    }
    kept.add(identity(row));
    if (JSON.stringify({ ...row, id: undefined }) !== JSON.stringify({ ...next, id: undefined })) {
      await db.updateTable('derived_flow').set(next).where('workspaceId', '=', workspaceId).where('id', '=', row.id)
        .execute();
    }
  }
  const added = [...wanted].filter(([identityOf]) => !kept.has(identityOf))
    .map(([, row]) => ({ ...row, id: newId(), workspaceId }));
  if (added.length > 0) {
    await db.insertInto('derived_flow').values(added).execute();
  }
}
