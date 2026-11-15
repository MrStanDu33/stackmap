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
const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();

export function inventoryRows(
  entities: readonly EntityRow[],
  { columns, query, locale, display, kindField }: RowsOptions,
): Rows {
  const [primary] = columns;
  const sorted = columns.find(({ field }) => field === query.sort) ?? primary;
  const needle = fold(query.q.trim());
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });

  const shown = (entity: EntityRow) => [...columns.map((column) => display(entity, column)), ...entity.tags];
  const matching = entities.filter((entity) => (
    query.status.length === 0 || query.status.includes(entity.status as never))
  && (query.kind.length === 0 || !kindField || query.kind.includes(entity[kindField] as string))
  && (!needle || shown(entity).some((text) => fold(text).includes(needle))));

  const value = (entity: EntityRow, column: InventoryColumn | undefined): string | number => {
    if (!column) {
      return '';
    }
    const raw = entity[column.field];
    return (column.format === 'number' || column.format === 'date') && raw !== null && raw !== undefined
      ? (typeof raw === 'number' ? raw : Date.parse(raw as string))
      : display(entity, column);
  };
  const compare = (a: string | number, b: string | number) => (typeof a === 'number' && typeof b === 'number'
    ? a - b
    : collator.compare(String(a), String(b)));
  const isEmpty = (item: string | number) => item === '';

  const ordered = matching.map((entity) => ({ entity, key: value(entity, sorted), name: value(entity, primary) }))
    .sort((a, b) => {
      // Empty values last in both directions; ties by the first column, ascending.
      if (isEmpty(a.key) !== isEmpty(b.key)) {
        return isEmpty(a.key) ? 1 : -1;
      }
      const order = compare(a.key, b.key) * (query.dir === 'desc' ? -1 : 1);
      return order === 0 ? compare(a.name, b.name) : order;
    })
    .map(({ entity }) => entity);

  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const page = Math.min(query.page, pages);
  return { rows: ordered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), matching: ordered.length, page, pages };
}
