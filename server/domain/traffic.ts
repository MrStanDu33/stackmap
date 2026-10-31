import type { TraceFlow } from './trace';
import type { Traffic } from '../../shared/contracts/traffic';

/** What a traffic graph is built from: the workspace's hosts, services, listeners and stored flows. */
export interface TrafficEntities {
  hosts: readonly { id: string; name: string; kind: string }[];
  services: readonly { id: string; name: string; kind: string; hostId: string | null }[];
  listeners: readonly {
    id: string;
    serviceId: string;
    port: number;
    transport: string;
    protocol: string | null;
    publishedPort: number | null;
  }[];
  flows: readonly TraceFlow[];
}

/** The traffic graph: sorted, capped, and with every reference resolving to an item it keeps. */
export function buildTraffic(_entities: TrafficEntities): Traffic {
  throw new Error('Not implemented');
}
