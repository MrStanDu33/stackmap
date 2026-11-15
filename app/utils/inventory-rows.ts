import type { InventoryQuery } from './inventory-query';
import type { InventoryColumn } from '@stackmap/extension-sdk';

export const PAGE_SIZE = 50;

/** An entity as the API sends it. */
export type EntityRow = Record<string, unknown> & { id: string; status: string; tags: string[] };

export interface RowsOptions {
  columns: readonly InventoryColumn[];
  query: InventoryQuery;
  locale: string;
  /** The text a cell shows: a reference's name, a kind's label, a date. */
  display: (entity: EntityRow, column: InventoryColumn) => string;
  /** The field the kind filter applies to, when the type has one. */
  kindField?: string;
}

export interface Rows {
  /** The current page's rows. */
  rows: EntityRow[];
  /** Rows matching the search and filters, across pages. */
  matching: number;
  /** The page shown, from 1, clamped to the last. */
  page: number;
  pages: number;
}

/** Searches, filters, sorts and pages the entities, as the table shows them. */
export function inventoryRows(_entities: readonly EntityRow[], _options: RowsOptions): Rows {
  throw new Error('Not implemented');
}
