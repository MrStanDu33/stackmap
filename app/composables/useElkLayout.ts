import type { TrafficLayout, Translate } from '../utils/traffic-graph';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Ref } from 'vue';

export interface ElkLayoutOptions<T> {
  t: Translate;
  toElk: (source: T) => ElkNode;
  toFlow: (source: T, laidOut: ElkNode, t: Translate) => TrafficLayout;
  /** Lays out an ELK graph: ELK in a web worker by default. */
  run?: (graph: ElkNode) => Promise<ElkNode>;
}

/** Lays out a graph each time its source changes; keeps the last layout while a new one is computed. */
export function useElkLayout<T>(_source: Ref<T | undefined>, _options: ElkLayoutOptions<T>): {
  layout: Ref<TrafficLayout | null>;
  pending: Ref<boolean>;
  error: Ref<unknown>;
  retry: () => void;
} {
  throw new Error('Not implemented');
}
