import { onScopeDispose, ref, watch } from 'vue';

import type { SearchHit } from '../../shared/contracts/search';
import type { PaletteEntities } from '../utils/palette-groups';
import type { Ref } from 'vue';

const SETTLE_MS = 200;
const LIMIT = 20;

/** The workspace's entities matching what is typed in the palette, searched once typing settles. */
export function usePaletteSearch(workspaceId: () => string | undefined, q: () => string): Ref<PaletteEntities> {
  const entities = ref<PaletteEntities>({ state: 'idle', hits: [] });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: AbortController | undefined;

  watch([workspaceId, () => q().trim()], ([id, words]) => {
    clearTimeout(timer);
    // Only the last request counts: an earlier one answering late would show stale results.
    pending?.abort();
    if (!id || !words) {
      entities.value = { state: 'idle', hits: [] };
      return;
    }
    entities.value = { state: 'loading', hits: [] };
    timer = setTimeout(() => {
      const request = new AbortController();
      pending = request;
      $fetch<{ items: SearchHit[] }>(`/api/workspaces/${id}/search`, {
        query: { q: words, limit: LIMIT },
        signal: request.signal,
      }).then(({ items }) => {
        entities.value = { state: 'done', hits: items };
      }, () => {
        if (!request.signal.aborted) {
          entities.value = { state: 'failed', hits: [] };
        }
      });
    }, SETTLE_MS);
  });
  onScopeDispose(() => {
    clearTimeout(timer);
    pending?.abort();
  });
  return entities;
}
