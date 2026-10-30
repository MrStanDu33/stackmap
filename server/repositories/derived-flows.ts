import type { Database } from '../database/types/schema';
import type { FlowBasis, FlowClient } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** A flow a deriver produced, as stored: rewritten by every refresh, never edited. */
export interface DerivedFlow {
  id: string;
  extension: string;
  deriver: string;
  key: string;
  sourceServiceId: string | null;
  sourceClient: FlowClient | null;
  targetListenerId: string;
  protocol: string | null;
  encrypted: boolean | null;
  hostnames: string[];
  basis: FlowBasis[];
}

/** The workspace's derived flows, by extension, deriver and key. */
export function listDerivedFlows(_db: Kysely<Database>, _workspaceId: string): Promise<DerivedFlow[]> {
  return Promise.reject(new Error('Not implemented'));
}
