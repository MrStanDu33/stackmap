import type { ExtensionRegistry } from './registry';
import type { Database } from '../database/types/schema';
import type { ExtensionServer } from '@stackmap/extension-sdk';
import type { Kysely } from 'kysely';
import type { NO_MIGRATIONS } from 'kysely/migration';

export interface MigrationLogger {
  info: (message: string) => void;
}

/**
 * Applies the active extensions' migrations, in registry order, each in its own history. A failing extension is
 * turned off with its dependents; a failing always-on extension throws.
 */
export function migrateExtensions(
  _db: Kysely<Database>,
  _registry: ExtensionRegistry,
  _logger: MigrationLogger,
): Promise<void> {
  return Promise.reject(new Error('Not implemented'));
}

/** Moves one extension's tables up or down to exactly `target`. */
export function migrateExtensionTo(
  _db: Kysely<Database>,
  _server: ExtensionServer,
  _target: string | typeof NO_MIGRATIONS,
): Promise<string[]> {
  return Promise.reject(new Error('Not implemented'));
}
