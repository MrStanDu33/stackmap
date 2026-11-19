import type { Display } from './preferences-sync';

/** What choosing an item does: open a page, change the display, or sign out. */
export type PaletteCommand
  = | { kind: 'navigate'; to: string }
    | { kind: 'display'; changes: Partial<Display> }
    | { kind: 'signOut' };

/** An item the palette can list: a page, a workspace, an action or an entity. */
export interface PaletteItem {
  id: string;
  label: string;
  /** A second line, such as an entity's type. */
  description?: string;
  icon?: string;
  /** A part of the label in another language, such as a language's own name: read in that language's voice. */
  foreign?: { text: string; lang: string };
  command?: PaletteCommand;
}

/** The semantic colors groups use, so that each is spotted at a glance (and named in text too). */
export type PaletteColor = 'primary' | 'info' | 'secondary' | 'warning';

/** Items under a named heading. */
export interface PaletteGroup {
  id: string;
  label: string;
  items: PaletteItem[];
  icon?: string;
  color?: PaletteColor;
  /** Matched on the server already: the palette shows its items as they are. */
  searched?: boolean;
  /** Said in place of its items, such as "Searching…" or "Search failed". */
  message?: string;
  /** Its message says something failed. */
  failed?: boolean;
}
