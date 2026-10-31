import { listDerivedFlows } from './derived-flows';
import { buildTraffic } from '../domain/traffic';

import type { TraceWorkspace } from './traces';
// The core's repositories (flows, listeners…) on WorkspaceRepositories, as in traces.ts.
import type {} from '../../extensions/core/server/repositories';
import type { Traffic } from '../../shared/contracts/traffic';

/**
 * The traffic graph of a workspace, from its entities and stored flows; each table is read once. The reads are not
 * one snapshot: a flow whose service or listener a concurrent write removed is left out.
 */
export async function readTraffic({ db, repos, workspaceId }: TraceWorkspace): Promise<Traffic> {
  const [derived, manual, listeners, services, hosts] = await Promise.all([
    listDerivedFlows(db, workspaceId, { basis: false }), repos.flows.list(), repos.listeners.list(),
    repos.services.list(), repos.hosts.list(),
  ]);
  return buildTraffic({
    hosts,
    services,
    listeners,
    flows: [
      ...derived.map((flow) => ({ ...flow, origin: 'derived' as const, purpose: null })),
      ...manual.map((flow) => ({
        id: flow.id, origin: 'manual' as const, extension: null, deriver: null, sourceServiceId: flow.sourceServiceId,
        sourceClient: null, targetListenerId: flow.targetListenerId, protocol: flow.protocol, encrypted: flow.encrypted,
        purpose: flow.purpose, hostnames: [], basis: [],
      })),
    ],
  });
}
