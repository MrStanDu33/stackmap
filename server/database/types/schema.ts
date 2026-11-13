import type { WorkspaceRole } from '../../../shared/contracts/contract';

/**
 * Tables of the Stackmap database, as stored: camelCase names, IDs, JSON and timestamps as text, booleans as 0/1
 * integers, identical on SQLite and Postgres. Convert values with server/database/serialize.ts.
 */
export interface Database {
  appSetting: AppSettingTable;
  workspace: WorkspaceTable;
  member: MemberTable;
  invitation: InvitationTable;
  derived_flow: DerivedFlowTable;
  user: UserTable;
  userPreference: UserPreferenceTable;
  rateLimit: RateLimitTable;
}

/**
 * Better Auth's accounts. Better Auth creates them and sets passwords; the app lists them, and changes the instance
 * role or deletes one itself, so that its checks run in the same transaction (the users page). Deleting cascades to
 * Better Auth's session and account rows. Its other tables (session, account, verification) are Better Auth's alone.
 */
export interface UserTable {
  id: string;
  email: string;
  name: string;
  /** The instance role, from Better Auth's admin plugin: `admin` or `user`. */
  role: string | null;
  /** A Date from Postgres, an ISO string from SQLite. */
  createdAt: Date | string;
  /** Set when an administrator gave a temporary password; cleared when the account changes it. 0/1 on SQLite. */
  mustChangePassword: boolean | number;
}

/** A pending invitation to a workspace: the link's token is never stored, only its SHA-256 hash. */
export interface InvitationTable {
  id: string;
  workspaceId: string;
  /** Lower case. */
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedById: string | null;
  createdAt: string;
  expiresAt: string;
}

/** Who belongs to a workspace, and with which role. */
export interface MemberTable {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

/** Attempts per key and window, for the sign-in and setup limits. */
export interface RateLimitTable {
  id: string;
  key: string;
  count: number;
  /** Milliseconds since the epoch: a bigint, which Postgres returns as text. */
  lastRequest: number | string;
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

/** A person's display preferences and landing page; a null column was never chosen. Deleted with its account. */
export interface UserPreferenceTable {
  userId: string;
  theme: string | null;
  contrast: string | null;
  locale: string | null;
  landingPage: string | null;
  updatedAt: string;
}
