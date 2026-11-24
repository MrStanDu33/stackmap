import type { Display } from './preferences-sync';

/** What a filter chip keeps: one group, one extension's entities, or one type's. */
export type PaletteFilter
  = | { kind: 'group'; group: 'entities' | 'pages' | 'workspaces' | 'actions' }
    | { kind: 'extension'; extension: string }
    | { kind: 'type'; extension: string; entity: string };

/** A filter the palette offers, or the chip it became: what it keeps, its name, and the word that named it. */
export interface PaletteFilterOption {
  filter: PaletteFilter;
  name: string;
  /** What was typed, given back when the chip is removed. */
  word: string;
  icon?: string;
  color?: PaletteColor;
}

/** What choosing an item does: open a page, change the display, sign out, or answer a filter offer. */
export type PaletteCommand
  = | { kind: 'navigate'; to: string }
    | { kind: 'display'; changes: Partial<Display> }
    | { kind: 'signOut' }
    | { kind: 'filter'; option: PaletteFilterOption }
    /** Search the word as typed: no filter is offered for it again. */
    | { kind: 'keepWord'; word: string }
    /** List the extensions' and types' filters (true), or go back to all filters (false). */
    | { kind: 'browseFilters'; extensions: boolean };

/** An item the palette can list: a page, a workspace, an action or an entity. */
export interface PaletteItem {
  id: string;
  label: string;
  /** A second line, such as an entity's type. */
  description?: string;
  icon?: string;
  /** The part of the label matched against what is typed (a filter's name), or '' for none; else the label. */
  match?: string;
  /** A part of the label in another language, such as a language's own name: read in that language's voice. */
  foreign?: { text: string; lang: string };
  command?: PaletteCommand;
  /** The id of the item to make active once this one is chosen and the list changes (Back: the entry it left). */
  returnTo?: string;
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
