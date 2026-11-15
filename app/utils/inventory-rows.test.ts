import { describe, expect, it } from 'vitest';

import { DEFAULT_INVENTORY_QUERY } from './inventory-query';
import { inventoryRows, PAGE_SIZE } from './inventory-rows';

import type { InventoryQuery } from './inventory-query';
import type { EntityRow, RowsOptions } from './inventory-rows';
import type { InventoryColumn } from '@stackmap/extension-sdk';

const COLUMNS: InventoryColumn[] = [
  { field: 'name', label: 'extensions.core.fields.host.name' },
  { field: 'kind', label: 'extensions.core.fields.host.kind', format: 'kind' },
  { field: 'siteId', label: 'extensions.core.fields.host.siteId', format: 'reference', reference: 'core/site' },
  { field: 'port', label: 'extensions.core.fields.listener.port', format: 'number' },
];

const SITES: Record<string, string> = { s1: 'Home', s2: 'Café' };
const KINDS: Record<string, string> = { physical: 'Physical server', vm: 'Virtual machine' };

const row = (id: string, fields: Partial<EntityRow> = {}): EntityRow => ({
  id, name: id, kind: 'vm', siteId: null, port: null, status: 'active', tags: [], ...fields,
});

const ENTITIES = [
  row('nas', { kind: 'physical', siteId: 's1', port: 445, tags: ['storage'] }),
  row('Blog', { siteId: 's2', port: 8443 }),
  row('db10', { port: 5432, status: 'planned' }),
  row('db9', { port: 80, status: 'deprecated' }),
];

const display: RowsOptions['display'] = (entity, { field, format }) => {
  const value = entity[field];
  if (value === null || value === undefined) {
    return '';
  }
  if (format === 'reference') {
    return SITES[value as string] ?? 'Unknown';
  }
  const text = typeof value === 'number' ? String(value) : value as string;
  return format === 'kind' ? KINDS[text] ?? text : text;
};

const names = (query: Partial<InventoryQuery>, entities = ENTITIES) => inventoryRows(entities, {
  columns: COLUMNS, query: { ...DEFAULT_INVENTORY_QUERY, ...query }, locale: 'en', display, kindField: 'kind',
}).rows.map(({ id }) => id);

describe('inventoryRows', () => {
  it('sorts by the first column ascending by default', () => {
    expect(names({})).toEqual(['Blog', 'db9', 'db10', 'nas']);
  });

  it('sorts by a column ascending, then descending, in the locale\'s order, numbers numerically', () => {
    expect(names({ sort: 'port' })).toEqual(['db9', 'nas', 'db10', 'Blog']);
    expect(names({ sort: 'port', dir: 'desc' })).toEqual(['Blog', 'db10', 'nas', 'db9']);
    expect(names({ sort: 'name', dir: 'desc' })).toEqual(['nas', 'db10', 'db9', 'Blog']);
  });

  it('sorts empty values last in both directions', () => {
    expect(names({ sort: 'siteId' })).toEqual(['Blog', 'nas', 'db9', 'db10']);
    expect(names({ sort: 'siteId', dir: 'desc' })).toEqual(['nas', 'Blog', 'db9', 'db10']);
  });

  it('searches shown values and tags, ignoring case and accents', () => {
    expect(names({ q: 'VIRTUAL' })).toEqual(['Blog', 'db9', 'db10']);
    expect(names({ q: 'storage' })).toEqual(['nas']);
    expect(names({ q: 'db1' })).toEqual(['db10']);
  });

  it('searches a reference column by the referenced entity\'s name', () => {
    expect(names({ q: 'cafe' })).toEqual(['Blog']);
    expect(names({ q: 's2' })).toEqual([]);
  });

  it('filters by status, and by kind when the type has one', () => {
    expect(names({ status: ['planned', 'deprecated'] })).toEqual(['db9', 'db10']);
    expect(names({ kind: ['physical'] })).toEqual(['nas']);
    expect(names({ kind: ['physical'], status: ['planned'] })).toEqual([]);
  });

  it('pages 50 rows at a time and clamps a page past the end to the last page', () => {
    const many = Array.from({ length: 120 }, (_, index) => row(`host-${String(index).padStart(3, '0')}`));
    const options = { columns: COLUMNS, locale: 'en', display };

    const second = inventoryRows(many, { ...options, query: { ...DEFAULT_INVENTORY_QUERY, page: 2 } });
    expect(second.rows).toHaveLength(PAGE_SIZE);
    expect(second.rows[0]?.id).toBe('host-050');
    expect(second.pages).toBe(3);

    const past = inventoryRows(many, { ...options, query: { ...DEFAULT_INVENTORY_QUERY, page: 9 } });
    expect(past.page).toBe(3);
    expect(past.rows).toHaveLength(20);
  });

  it('counts the matching rows across pages', () => {
    const many = Array.from({ length: 120 }, (_, index) => row(`host-${String(index)}`, { status: index % 2 ? 'planned' : 'active' }));

    const result = inventoryRows(many, {
      columns: COLUMNS, locale: 'en', display, query: { ...DEFAULT_INVENTORY_QUERY, status: ['planned'] },
    });
    expect(result.matching).toBe(60);
    expect(result.pages).toBe(2);
  });
});
