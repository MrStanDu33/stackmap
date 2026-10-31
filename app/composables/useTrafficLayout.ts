import { useElkLayout } from './useElkLayout';
import { elkToVueFlow, trafficToElk } from '../utils/traffic-graph';

import type { Traffic } from '../../shared/contracts/traffic';
import type { Translate } from '../utils/traffic-graph';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Ref } from 'vue';

export interface TrafficLayoutOptions {
  t: Translate;
  /** Lays out an ELK graph: ELK in a web worker by default. */
  run?: (graph: ElkNode) => Promise<ElkNode>;
}

/** Lays out the traffic each time it changes; keeps the last layout while a new one is computed. */
export const useTrafficLayout = (traffic: Ref<Traffic | undefined>, options: TrafficLayoutOptions) =>
  useElkLayout(traffic, { ...options, toElk: trafficToElk, toFlow: elkToVueFlow });
