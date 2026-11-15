import type { EntityStatus } from '@stackmap/extension-sdk/entities';

export interface InventoryQuery {
  q: string;
  /** A column's field; `null`: the first column. */
  sort: string | null;
  dir: 'asc' | 'desc';
  status: EntityStatus[];
  kind: string[];
  /** From 1. */
  page: number;
}

export type RawQuery = Record<string, string | null | (string | null)[] | undefined>;

export const DEFAULT_INVENTORY_QUERY: InventoryQuery = { q: '', sort: null, dir: 'asc', status: [], kind: [], page: 1 };

/** The table's state from the URL; values that do not fit are dropped. */
export function parseInventoryQuery(_raw: RawQuery, _fields: readonly string[]): InventoryQuery {
  throw new Error('Not implemented');
}

/** The URL query of the table's state: only what differs from the defaults. */
export function inventoryQueryToUrl(_query: InventoryQuery): Record<string, string | string[]> {
  throw new Error('Not implemented');
}
