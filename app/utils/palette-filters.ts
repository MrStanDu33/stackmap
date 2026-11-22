import type { PaletteFilterOption } from './palette';
import type { PaletteType } from './palette-groups';

/** An extension the palette can filter by: one active and on in the workspace. */
export interface PaletteExtension {
  id: string;
  /** Its name, translated. */
  name: string;
  icon?: string;
}

export interface PaletteFilterContext {
  q: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  extensions: readonly PaletteExtension[];
  types: readonly PaletteType[];
  /** What the user hid in Settings. */
  hidden: readonly string[];
  /** The chip already chosen, if any. */
  filter: PaletteFilterOption | null;
}

/** The filters a single typed word names: groups, extensions and entity types, in the current language. */
export function paletteFilters(_context: PaletteFilterContext): PaletteFilterOption[] {
  return [];
}
