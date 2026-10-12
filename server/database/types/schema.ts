/**
 * Tables of the Stackmap database, as stored: camelCase names, IDs, JSON and timestamps as text, booleans as 0/1
 * integers, identical on SQLite and Postgres. Convert values with server/database/serialize.ts.
 */
export interface Database {
  appSetting: AppSettingTable;
  workspace: WorkspaceTable;
  site: SiteTable;
  network: NetworkTable;
  host: HostTable;
  hostAddress: HostAddressTable;
  service: ServiceTable;
  listener: ListenerTable;
  domain: DomainTable;
  dnsRecord: DnsRecordTable;
}

/** Instance-wide settings (registration toggle, default landing page…), one JSON value per key. */
export interface AppSettingTable {
  key: string;
  /** JSON text. */
  value: string;
  /** ISO-8601 UTC timestamp text. */
  updatedAt: string;
}

export interface WorkspaceTable {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

/** Columns every entity table has. */
export interface EntityColumns {
  id: string;
  workspaceId: string;
  status: string;
  /** JSON array of strings. */
  tags: string;
  notes: string;
  /** JSON array of `{ label, url }`. */
  links: string;
  /** JSON object. */
  customFields: string;
  origin: string;
  externalRef: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteTable extends EntityColumns {
  name: string;
}

export interface NetworkTable extends EntityColumns {
  name: string;
  kind: string;
  cidr: string | null;
  vlan: number | null;
  siteId: string | null;
}

export interface HostTable extends EntityColumns {
  name: string;
  kind: string;
  os: string | null;
  siteId: string | null;
}

/** A host's IP addresses, owned by the host. Ordered by id, which is creation order. */
export interface HostAddressTable {
  id: string;
  workspaceId: string;
  hostId: string;
  networkId: string | null;
  address: string;
}

export interface ServiceTable extends EntityColumns {
  name: string;
  kind: string;
  hostId: string | null;
  image: string | null;
  containerName: string | null;
}

export interface ListenerTable extends EntityColumns {
  serviceId: string;
  port: number;
  transport: string;
  protocol: string | null;
  bindAddress: string | null;
  publishedPort: number | null;
}

export interface DomainTable extends EntityColumns {
  name: string;
}

export interface DnsRecordTable extends EntityColumns {
  domainId: string;
  name: string;
  type: string;
  value: string;
  view: string;
  /** 0 or 1. */
  proxied: number;
}
