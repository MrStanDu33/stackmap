import type { PaletteEntities } from '../utils/palette-groups';
import type { Ref } from 'vue';

/** The workspace's entities matching what is typed in the palette, searched once typing settles. */
export function usePaletteSearch(_workspaceId: () => string | undefined, _q: () => string): Ref<PaletteEntities> {
  throw new Error('Not implemented');
}
