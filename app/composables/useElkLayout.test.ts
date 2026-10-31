import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useElkLayout } from './useElkLayout';
import { DEMO_TRACE } from '../../tests/support/demo-trace';
import { traceElkToVueFlow, traceToElk } from '../utils/trace-graph';

import type { ElkNode } from 'elkjs/lib/elk-api';

const placeAll = (node: ElkNode): ElkNode => ({ ...node, x: 0, y: 0, children: node.children?.map(placeAll) });

describe('useElkLayout', () => {
  it('lays out a trace through the same worker path as the traffic, whose tests stay unchanged', async () => {
    const run = vi.fn((graph: ElkNode) => Promise.resolve(placeAll(graph)));

    const { layout, pending } = useElkLayout(ref(DEMO_TRACE), {
      t: (key: string) => key, toElk: traceToElk, toFlow: traceElkToVueFlow, run,
    });

    await vi.waitFor(() => {
      expect(pending.value).toBe(false);
    });
    expect(run).toHaveBeenCalledOnce();
    expect(layout.value?.nodes).toHaveLength(DEMO_TRACE.nodes.length);
    expect(layout.value?.edges).toHaveLength(DEMO_TRACE.steps.length);
  });
});
