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

/** The workspace's audit events, newest first. */
export function listAuditEvents(
  db: Kysely<Database>,
  workspaceId: string,
  options: { limit?: number } = {},
): Promise<AuditEvent[]> {
  return Promise.reject(new Error(`Not implemented: ${workspaceId}, ${String(options.limit ?? MAX_AUDIT_EVENTS)}`, { cause: db }));
}
