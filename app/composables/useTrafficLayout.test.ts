import { describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

import { useTrafficLayout } from './useTrafficLayout';
import { DEMO_TRAFFIC } from '../../tests/support/demo-traffic';

import type { Traffic } from '../../shared/contracts/traffic';
import type { ElkNode } from 'elkjs/lib/elk-api';

const t = (key: string) => key;
const EMPTY: Traffic = { hosts: [], services: [], listeners: [], flows: [], truncated: false };

/** ELK stand-in: places every node at the origin. */
const placeAll = (node: ElkNode): ElkNode => ({ ...node, x: 0, y: 0, children: node.children?.map(placeAll) });

const settled = () => vi.waitFor(async () => {
  await nextTick();
});

describe('useTrafficLayout', () => {
  it('given an empty traffic, resolves to a layout with no node', async () => {
    const run = vi.fn((graph: ElkNode) => Promise.resolve(placeAll(graph)));

    const { layout, pending, error } = useTrafficLayout(ref(EMPTY), { t, run });

    await vi.waitFor(() => {
      expect(pending.value).toBe(false);
    });
    expect(layout.value).toEqual({ nodes: [], edges: [] });
    expect(error.value).toBeNull();
  });

  it('given the layout worker fails, reports the error and keeps no partial layout', async () => {
    const failure = new Error('Worker crashed');
    const run = vi.fn<(graph: ElkNode) => Promise<ElkNode>>(() => Promise.reject(failure));

    const { layout, pending, error, retry } = useTrafficLayout(ref(DEMO_TRAFFIC), { t, run });

    await vi.waitFor(() => {
      expect(error.value).toBe(failure);
    });
    expect(layout.value).toBeNull();
    expect(pending.value).toBe(false);

    run.mockImplementation((graph: ElkNode) => Promise.resolve(placeAll(graph)));
    retry();
    await settled();
    await vi.waitFor(() => {
      expect(layout.value?.nodes.length).toBeGreaterThan(0);
    });
    expect(error.value).toBeNull();
  });
});
