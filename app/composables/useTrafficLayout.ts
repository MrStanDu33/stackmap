import type { Traffic } from '../../shared/contracts/traffic';
import type { TrafficLayout, Translate } from '../utils/traffic-graph';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Ref } from 'vue';

export interface TrafficLayoutOptions {
  t: Translate;
  /** Lays out an ELK graph: ELK in a web worker by default. */
  run?: (graph: ElkNode) => Promise<ElkNode>;
}

/** Lays out the traffic each time it changes; keeps the last layout while a new one is computed. */
export function useTrafficLayout(_traffic: Ref<Traffic | undefined>, _options: TrafficLayoutOptions): {
  layout: Ref<TrafficLayout | null>;
  pending: Ref<boolean>;
  error: Ref<unknown>;
  retry: () => void;
} {
  throw new Error('Not implemented');
}
