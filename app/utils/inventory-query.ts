import { ENTITY_STATUSES } from '@stackmap/extension-sdk/entities';

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
const all = (value: RawQuery[string]): string[] => (Array.isArray(value) ? value : [value])
  .filter((item): item is string => typeof item === 'string' && item !== '');
const first = (value: RawQuery[string]): string => all(value)[0] ?? '';
const isStatus = (value: string): value is EntityStatus => (ENTITY_STATUSES as readonly string[]).includes(value);

export function parseInventoryQuery(raw: RawQuery, fields: readonly string[]): InventoryQuery {
  const sort = first(raw.sort);
  const page = Number(first(raw.page));
  return {
    q: first(raw.q),
    sort: fields.includes(sort) ? sort : null,
    dir: first(raw.dir) === 'desc' ? 'desc' : 'asc',
    status: all(raw.status).filter(isStatus),
    kind: all(raw.kind),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** The URL query of the table's state: only what differs from the defaults. */
export function inventoryQueryToUrl(
  { q, sort, dir, status, kind, page }: InventoryQuery,
): Record<string, string | string[]> {
  return {
    ...(q ? { q } : {}),
    ...(sort ? { sort } : {}),
    ...(dir === 'desc' ? { dir } : {}),
    ...(status.length > 0 ? { status } : {}),
    ...(kind.length > 0 ? { kind } : {}),
    ...(page > 1 ? { page: String(page) } : {}),
  };
}
