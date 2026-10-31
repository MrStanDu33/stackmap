import type { WorkspaceRepositories } from './index';
import type { Trace } from '../../shared/contracts/traces';
import type { Database } from '../database/types/schema';
import type { TraceOptions, TraceRequest } from '../domain/trace';
import type { Kysely } from 'kysely';

/** Where a trace is computed: a workspace, its repositories and the database holding its derived flows. */
export interface TraceWorkspace {
  db: Kysely<Database>;
  repos: WorkspaceRepositories;
  workspaceId: string;
}

/** The trace of a hostname in a workspace, from its stored flows, read in one transaction. */
export function traceWorkspace(
  _workspace: TraceWorkspace,
  _request: TraceRequest,
  _options: Omit<TraceOptions, 'read'>,
): Promise<Trace> {
  return Promise.reject(new Error('traceWorkspace is not implemented yet.'));
}
