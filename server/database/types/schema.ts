/**
 * Tables of the Stackmap database, as stored: camelCase names, IDs, JSON and timestamps as text, booleans as 0/1
 * integers, identical on SQLite and Postgres. Convert values with server/database/serialize.ts.
 */
export interface Database {
  appSetting: AppSettingTable;
  workspace: WorkspaceTable;
  derived_flow: DerivedFlowTable;
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

/** Flows the extensions' derivers produce, rewritten after every write. */
export interface DerivedFlowTable {
  id: string;
  workspaceId: string;
  extension: string;
  deriver: string;
  key: string;
  sourceServiceId: string | null;
  sourceClient: string | null;
  targetListenerId: string;
  protocol: string | null;
  /** 0 or 1, null when unknown. */
  encrypted: number | null;
  /** JSON array of hostnames. */
  hostnames: string;
  /** JSON array of `{ entity, id }`. */
  basis: string;
}
