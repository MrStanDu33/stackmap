import type { CoreDatabase, EntityColumns } from '@stackmap/extension-core/server/types';

/** The extension's tables, as stored, with the core tables they refer to. */
export interface NatDatabase extends CoreDatabase {
  nat_portForward: PortForwardTable;
}

export interface PortForwardTable extends EntityColumns {
  hostId: string;
  externalAddress: string;
  externalPort: number;
  transport: string;
  internalAddress: string;
  internalPort: number;
  description: string | null;
}
