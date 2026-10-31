import { listDerivedFlows } from './derived-flows';
import { computeTrace } from '../domain/trace';

import type { WorkspaceRepositories } from './index';
// The core's repositories (flows, listeners…) on WorkspaceRepositories, for programs that reach this file through
// the typed routes without the server's extension registry.
import type {} from '../../extensions/core/server/repositories';
import type { Trace } from '../../shared/contracts/traces';
import type { Database } from '../database/types/schema';
import type { TraceFlow, TraceOptions, TraceRequest } from '../domain/trace';
import type { FlowReader } from '@stackmap/extension-sdk/server';
import type { Kysely } from 'kysely';

/** Where a trace is computed: a workspace, its repositories and the database holding its derived flows. */
export interface TraceWorkspace {
  db: Kysely<Database>;
  repos: WorkspaceRepositories;
  workspaceId: string;
}

/**
 * The trace of a hostname in a workspace, from its stored flows. The reads are not one snapshot: a flow whose
 * listener a concurrent write removed is left out by the walk.
 */
export async function traceWorkspace(
  { db, repos, workspaceId }: TraceWorkspace,
  request: TraceRequest,
  options: Omit<TraceOptions, 'read'>,
): Promise<Trace> {
  const [derived, manual, listeners, services, hosts] = await Promise.all([
    listDerivedFlows(db, workspaceId), repos.flows.list(), repos.listeners.list(), repos.services.list(),
    repos.hosts.list(),
  ]);
  const flows: TraceFlow[] = [
    ...derived.map((flow) => ({ ...flow, origin: 'derived' as const, purpose: null })),
    ...manual.map((flow) => ({
      id: flow.id, origin: 'manual' as const, extension: null, deriver: null, sourceServiceId: flow.sourceServiceId,
      sourceClient: null, targetListenerId: flow.targetListenerId, protocol: flow.protocol, encrypted: flow.encrypted,
      purpose: flow.purpose, hostnames: [], basis: [],
    })),
  ];
  // Resolvers only read: they get each repository's get and list, as derivers do.
  const repositories = Object.entries(repos as unknown as Record<string, FlowReader[keyof FlowReader]>);
  const read = Object.fromEntries(repositories.filter(([key]) => key !== 'transaction')
    .map(([key, { get, list }]) => [key, { get, list }])) as unknown as FlowReader;
  return computeTrace({ flows, listeners, services, hosts }, request, { ...options, read });
}
