import type { TrafficLayout, Translate } from './traffic-graph';
import type { Trace } from '../../shared/contracts/traces';
import type { ElkNode } from 'elkjs/lib/elk-api';

/** The trace as an ELK graph: the client and each listener as nodes, each step as an edge. */
export function traceToElk(_trace: Trace): ElkNode {
  throw new Error('Not implemented');
}

/** The laid-out trace as Vue Flow nodes and edges, each with its accessible name. */
export function traceElkToVueFlow(_trace: Trace, _laidOut: ElkNode, _t: Translate): TrafficLayout {
  throw new Error('Not implemented');
}
