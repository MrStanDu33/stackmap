import type { Traffic } from '../../shared/contracts/traffic';
import type { Edge, Node } from '@vue-flow/core';
import type { ElkNode } from 'elkjs/lib/elk-api';

/** Translates a key with its parameters: the app's `t`. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** The traffic graph as Vue Flow draws it. */
export interface TrafficLayout {
  nodes: Node[];
  edges: Edge[];
}

/** The traffic as an ELK graph: hosts holding services, services with their ports, flows as edges to ports. */
export function trafficToElk(_traffic: Traffic): ElkNode {
  throw new Error('Not implemented');
}

/** The laid-out ELK graph as Vue Flow nodes and edges, each with its accessible name. */
export function elkToVueFlow(_traffic: Traffic, _laidOut: ElkNode, _t: Translate): TrafficLayout {
  throw new Error('Not implemented');
}
