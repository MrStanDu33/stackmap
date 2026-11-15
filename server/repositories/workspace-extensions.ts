import { inTransaction } from './entity-repository';
import { toTimestamp } from '../database/serialize';

import type { Database } from '../database/types/schema';
import type { Kysely } from 'kysely';

/** The extensions turned off in the workspace, installed or not. */
export async function disabledExtensions(db: Kysely<Database>, workspaceId: string): Promise<Set<string>> {
  const rows = await db.selectFrom('workspace_extension_disabled').select('extension')
    .where('workspaceId', '=', workspaceId).execute();
  return new Set(rows.map(({ extension }) => extension));
}

/** Whether each of the extensions is on in the workspace: on unless it was turned off there. */
export async function extensionStates(
  db: Kysely<Database>,
  workspaceId: string,
  ids: readonly string[],
): Promise<Map<string, boolean>> {
  const disabled = await disabledExtensions(db, workspaceId);
  return new Map(ids.map((id) => [id, !disabled.has(id)]));
}

/** Turns the extensions on or off in the workspace, in one transaction; who first turned one off is kept. */
export async function setExtensionsEnabled(
  db: Kysely<Database>,
  workspaceId: string,
  ids: readonly string[],
  enabled: boolean,
  actorId: string | null,
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  // Within the caller's transaction when given one.
  await inTransaction(db, async (trx) => {
    if (enabled) {
      await trx.deleteFrom('workspace_extension_disabled')
        .where('workspaceId', '=', workspaceId).where('extension', 'in', ids).execute();
      // Back on, nothing of it is hidden: the choices to keep its entities hidden have nothing left to say.
      await trx.deleteFrom('workspace_hidden_entity_kept')
        .where('workspaceId', '=', workspaceId).where('extension', 'in', ids).execute();
      return;
    }
    const disabledAt = toTimestamp(new Date());
    await trx.insertInto('workspace_extension_disabled')
      .values((expression) => ids.map((extension) => ({
        workspaceId,
        extension,
        disabledAt,
        // Null unless the actor is an account, as for audit events.
        disabledBy: actorId === null ? null : expression.selectFrom('user').select('id').where('id', '=', actorId),
      })))
      .onConflict((conflict) => conflict.columns(['workspaceId', 'extension']).doNothing())
      .execute();
  });
}
