import ElkConstructor from 'elkjs/lib/elk-api';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
import { ref, shallowRef, watch } from 'vue';

import { elkToVueFlow, trafficToElk } from '../utils/traffic-graph';

import type { Traffic } from '../../shared/contracts/traffic';
import type { TrafficLayout, Translate } from '../utils/traffic-graph';
import type { ELK, ElkNode } from 'elkjs/lib/elk-api';
import type { Ref } from 'vue';

export interface TrafficLayoutOptions {
  t: Translate;
  /** Lays out an ELK graph: ELK in a web worker by default. */
  run?: (graph: ElkNode) => Promise<ElkNode>;
}

let elk: ELK | undefined;

/** ELK in a web worker, created on first use and shared: the layout never blocks the page. */
const inWorker = (graph: ElkNode) => {
  elk ??= new ElkConstructor({ workerUrl });
  return elk.layout(graph);
};

/** Lays out the traffic each time it changes; keeps the last layout while a new one is computed. */
export function useTrafficLayout(traffic: Ref<Traffic | undefined>, { t, run = inWorker }: TrafficLayoutOptions): {
  layout: Ref<TrafficLayout | null>;
  pending: Ref<boolean>;
  error: Ref<unknown>;
  retry: () => void;
} {
  const layout = shallowRef<TrafficLayout | null>(null);
  const pending = ref(false);
  const error = shallowRef<unknown>(null);
  // Only the latest request may set the result: an older one can finish after it.
  let latest = 0;

  const compute = async () => {
    const current = traffic.value;
    if (!current) {
      return;
    }
    latest += 1;
    const request = latest;
    pending.value = true;
    error.value = null;
    try {
      const laidOut = await run(trafficToElk(current));
      if (request === latest) {
        layout.value = elkToVueFlow(current, laidOut, t);
      }
    } catch (failure) {
      if (request === latest) {
        error.value = failure;
        layout.value = null;
      }
    } finally {
      if (request === latest) {
        pending.value = false;
      }
    }
  };

  watch(traffic, () => {
    void compute();
  }, { immediate: true });

  return {
    layout,
    pending,
    error,
    retry: () => {
      void compute();
    },
  };
}
