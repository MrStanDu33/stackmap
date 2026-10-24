import { extensionTablePrefix } from '@stackmap/extension-sdk';

import { maskSecrets } from './runtime';
import { migrateTo, migrateToLatest } from '../database/migrator';

import type { ExtensionRegistry } from './registry';
import type { Database } from '../database/types/schema';
import type { ExtensionServer } from '@stackmap/extension-sdk';
import type { Kysely } from 'kysely';
import type { NO_MIGRATIONS } from 'kysely/migration';

export interface MigrationLogger {
  info: (message: string) => void;
  error?: (message: string) => void;
}

const historyOf = (extension: string) => ({ history: extensionTablePrefix(extension) });

/** Diagnostics show at most this many characters of an error. */
const MAX_ERROR = 1000;

/** As kept for diagnostics: credentials masked, and short enough for the API (the logs keep the whole message). */
const forDiagnostics = (message: string) => {
  const masked = maskSecrets(message);
  return masked.length > MAX_ERROR ? `${masked.slice(0, MAX_ERROR - 1)}…` : masked;
};

/**
 * Applies the active extensions' migrations after the app's, in registry order (dependencies first, so a table can
 * refer to one of an extension it depends on), each in its own history. A failing migration rolls back and turns its
 * extension off with its dependents, and the app keeps running; a failing always-on extension throws.
 */
export async function migrateExtensions(
  db: Kysely<Database>,
  registry: ExtensionRegistry,
  logger: MigrationLogger,
): Promise<void> {
  for (const { manifest, server, state } of registry.extensions) {
    // An extension may fail while an earlier one migrates: its dependents are then skipped too.
    if (state !== 'active' || registry.get(manifest.id)?.state !== 'active' || !server?.migrations) {
      continue;
    }
    try {
      const applied = await migrateToLatest(db, { ...server.migrations }, historyOf(manifest.id));
      logger.info(`[extension:${manifest.id}] ${applied.length > 0
        ? `Applied database migrations: ${applied.join(', ')}`
        : 'Database tables are up to date'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error?.(`[extension:${manifest.id}] failed: ${message}`);
      registry.fail(manifest.id, forDiagnostics(message));
    }
  }
}

/** Moves one extension's tables up or down to exactly `target`. */
export function migrateExtensionTo(
  db: Kysely<Database>,
  server: ExtensionServer,
  target: string | typeof NO_MIGRATIONS,
): Promise<string[]> {
  return migrateTo(db, target, { ...server.migrations }, historyOf(server.extension));
}
