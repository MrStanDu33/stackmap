import ElkConstructor from 'elkjs/lib/elk-api';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';
import { ref, shallowRef, watch } from 'vue';

import type { TrafficLayout, Translate } from '../utils/traffic-graph';
import type { ELK, ElkNode } from 'elkjs/lib/elk-api';
import type { Ref } from 'vue';

export interface ElkLayoutOptions<T> {
  t: Translate;
  toElk: (source: T) => ElkNode;
  toFlow: (source: T, laidOut: ElkNode, t: Translate) => TrafficLayout;
  /** Lays out an ELK graph: ELK in a web worker by default. */
  run?: (graph: ElkNode) => Promise<ElkNode>;
}

let elk: ELK | undefined;

/** ELK in a web worker, created on first use and shared: the layout never blocks the page. */
const inWorker = (graph: ElkNode) => {
  elk ??= new ElkConstructor({ workerUrl });
  return elk.layout(graph);
};

/** Lays out a graph each time its source changes; keeps the last layout while a new one is computed. */
export function useElkLayout<T>(
  source: Ref<T | undefined>,
  { t, toElk, toFlow, run = inWorker }: ElkLayoutOptions<T>,
): {
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
    const current = source.value;
    if (!current) {
      return;
    }
    latest += 1;
    const request = latest;
    pending.value = true;
    error.value = null;
    try {
      const laidOut = await run(toElk(current));
      if (request === latest) {
        layout.value = toFlow(current, laidOut, t);
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

  watch(source, () => {
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
