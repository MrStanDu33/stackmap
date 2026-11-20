import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { usePaletteSearch } from './usePaletteSearch';

const HIT = { extension: 'core', entity: 'host', id: '0199d6a0-0000-7000-8000-000000000002', title: 'Edge router', matched: 'name' };

// The workspace is passed explicitly: a default parameter would turn undefined into an id.
const setUp = (workspaceId: string | undefined) => {
  const q = ref('');
  const id = ref(workspaceId);
  const scope = effectScope();
  const entities = scope.run(() => usePaletteSearch(() => id.value, () => q.value));
  if (!entities) {
    throw new Error('No search');
  }
  return { q, id, entities, scope };
};

const flush = async (ms: number) => {
  await nextTick();
  await vi.advanceTimersByTimeAsync(ms);
};

describe('usePaletteSearch', () => {
  type Fetch = (url: string, options: { signal: AbortSignal }) => Promise<unknown>;
  let fetched: ReturnType<typeof vi.fn<Fetch>>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetched = vi.fn<Fetch>(() => Promise.resolve({ items: [HIT], truncated: false }));
    vi.stubGlobal('$fetch', fetched);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('searches the workspace 200 ms after typing stops, at most 20 entities (4)', async () => {
    const { q, entities } = setUp('w1');

    q.value = 'router';
    await flush(150);
    expect(fetched).not.toHaveBeenCalled();
    expect(entities.value.state).toBe('loading');

    await flush(60);
    expect(fetched).toHaveBeenCalledWith('/api/workspaces/w1/search', expect.objectContaining({
      query: { q: 'router', limit: 20 },
    }));
    expect(entities.value).toEqual({ state: 'done', hits: [HIT] });
  });

  it('cancels the previous request when typing goes on (4)', async () => {
    const signals: AbortSignal[] = [];
    fetched.mockImplementation((_url, { signal }) => {
      signals.push(signal);
      return new Promise(() => undefined);
    });
    const { q } = setUp('w1');

    q.value = 'rou';
    await flush(210);
    q.value = 'router';
    await flush(210);

    expect(signals.map(({ aborted }) => aborted)).toEqual([true, false]);
  });

  it('says it failed when the request fails, with no entities (4)', async () => {
    fetched.mockImplementation(() => Promise.reject(new Error('down')));
    const { q, entities } = setUp('w1');

    q.value = 'router';
    await flush(210);

    expect(entities.value).toEqual({ state: 'failed', hits: [] });
  });

  it('searches nothing for an empty search or without a workspace (3)', async () => {
    const { q, entities } = setUp(undefined);

    q.value = 'router';
    await flush(210);
    q.value = '  ';
    await flush(210);

    expect(fetched).not.toHaveBeenCalled();
    expect(entities.value).toEqual({ state: 'idle', hits: [] });
  });
});
