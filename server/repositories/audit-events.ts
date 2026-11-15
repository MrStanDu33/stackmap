import { newId } from '../database/ids';
import { fromJson, fromTimestamp, toJson, toTimestamp } from '../database/serialize';

import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

export type AuditAction = 'create' | 'update' | 'delete';

/** One entity write, as the audit log keeps it. */
export interface AuditEvent {
  id: string;
  actorId: string | null;
  action: AuditAction;
  extension: string;
  entity: string;
  entityId: string;
  fields: string[];
  createdAt: Date;
}

/** Most events one read returns. */
export const MAX_AUDIT_EVENTS = 1000;

/** Records a write, on the write's own connection so that it is kept only if the write is. */
export async function recordAuditEvent(
  db: Kysely<Database>,
  workspaceId: string,
  event: Omit<AuditEvent, 'id' | 'createdAt'>,
): Promise<void> {
  const { actorId, ...rest } = event;
  await db.insertInto('audit_event').values((expression) => ({
    id: newId(),
    workspaceId,
    ...rest,
    // Null unless the actor is an account (the system, an account removed meanwhile), as when it is removed later.
    actorId: actorId === null ? null : expression.selectFrom('user').select('id').where('id', '=', actorId),
    fields: toJson(event.fields),
    createdAt: toTimestamp(new Date()),
  })).execute();
}

/** The workspace's audit events, newest first. */
export async function listAuditEvents(
  db: Kysely<Database>,
  workspaceId: string,
  { limit = MAX_AUDIT_EVENTS }: { limit?: number } = {},
): Promise<AuditEvent[]> {
  const rows = await db.selectFrom('audit_event')
    .select(['id', 'actorId', 'action', 'extension', 'entity', 'entityId', 'fields', 'createdAt'])
    .where('workspaceId', '=', workspaceId)
    // Ids are time-ordered: they break ties within a millisecond.
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc')
    .limit(Math.min(limit, MAX_AUDIT_EVENTS))
    .execute();
  return rows.map((row) => ({
    ...row,
    action: row.action as AuditAction,
    fields: fromJson(row.fields, 'audit_event.fields') as string[],
    createdAt: fromTimestamp(row.createdAt, 'audit_event.createdAt'),
  }));
}
