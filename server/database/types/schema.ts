/**
 * Tables of the Stackmap database, as stored: camelCase names, IDs, JSON and timestamps as text, booleans as 0/1
 * integers, identical on SQLite and Postgres. Convert values with server/database/serialize.ts.
 */
export interface Database {
  appSetting: AppSettingTable;
  workspace: WorkspaceTable;
}

/** Instance-wide settings (registration toggle, default landing page…), one JSON value per key. */
export interface AppSettingTable {
  key: string;
  /** JSON text. */
  value: string;
  /** ISO-8601 UTC timestamp text. */
  updatedAt: string;
}

/** Workspaces: every entity belongs to one. */
export interface WorkspaceTable {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}
