import { listDerivedFlows, readerFor } from './derived-flows';
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

/** The repositories' reads, each list run once per filter for the length of a trace and shared by its resolvers. */
function memoisedReader(repos: WorkspaceRepositories): FlowReader {
  type Read = (...args: unknown[]) => Promise<unknown>;
  const repositories = Object.entries(repos as unknown as Record<string, { get: Read; list: Read }>)
    .filter(([key]) => key !== 'transaction');
  return Object.fromEntries(repositories.map(([key, { get, list }]) => {
    const lists = new Map<string, Promise<unknown>>();
    const memoised: Read = (...args) => {
      const filter = JSON.stringify(args);
      const listed = lists.get(filter) ?? list(...args);
      lists.set(filter, listed);
      return listed;
    };
    return [key, { get, list: memoised }];
  })) as unknown as FlowReader;
}

/**
 * The trace of a hostname in a workspace, from its stored flows. Each table is read once. The reads are not one
 * snapshot: a flow whose listener a concurrent write removed is left out by the walk.
 */
export async function traceWorkspace(
  { db, workspaceId, repos }: TraceWorkspace,
  request: TraceRequest,
  options: Omit<TraceOptions, 'reader'>,
): Promise<Trace> {
  const read = memoisedReader(repos);
  const [derived, manual, listeners, services, hosts] = await Promise.all([
    listDerivedFlows(db, workspaceId), read.flows.list(), read.listeners.list(), read.services.list(),
    read.hosts.list(),
  ]);
  const flows: TraceFlow[] = [
    ...derived.map((flow) => ({ ...flow, origin: 'derived' as const, purpose: null })),
    ...manual.map((flow) => ({
      id: flow.id, origin: 'manual' as const, extension: null, deriver: null, sourceServiceId: flow.sourceServiceId,
      sourceClient: null, targetListenerId: flow.targetListenerId, protocol: flow.protocol, encrypted: flow.encrypted,
      purpose: flow.purpose, hostnames: [], basis: [],
    })),
  ];
  // Resolvers only read, each call through its own frozen reader, refused once the call is over.
  const reader = (owner: string) => {
    const ended: { reason?: string } = {};
    const end = (reason: string) => {
      ended.reason = reason;
    };
    return { read: readerFor(read, owner, ended), end };
  };
  return computeTrace({ flows, listeners, services, hosts }, request, { ...options, reader });
}
