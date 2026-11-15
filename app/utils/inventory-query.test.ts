import { describe, expect, it } from 'vitest';

import { DEFAULT_INVENTORY_QUERY, inventoryQueryToUrl, parseInventoryQuery } from './inventory-query';

const FIELDS = ['name', 'kind', 'siteId'];

describe('inventory query', () => {
  it('reads q, sort, dir, status, kind and page from the URL', () => {
    expect(parseInventoryQuery({
      q: 'nas', sort: 'kind', dir: 'desc', status: ['active', 'planned'], kind: 'vm', page: '3',
    }, FIELDS)).toEqual({ q: 'nas', sort: 'kind', dir: 'desc', status: ['active', 'planned'], kind: ['vm'], page: 3 });
    expect(parseInventoryQuery({}, FIELDS)).toEqual(DEFAULT_INVENTORY_QUERY);
  });

  it('ignores a sort on an unknown column, an unknown status and a page that is not a positive integer', () => {
    expect(parseInventoryQuery({ sort: 'password', dir: 'sideways', status: ['gone', 'active'], page: '0' }, FIELDS))
      .toEqual({ ...DEFAULT_INVENTORY_QUERY, status: ['active'] });
    expect(parseInventoryQuery({ page: '2.5' }, FIELDS).page).toBe(1);
    expect(parseInventoryQuery({ page: 'abc' }, FIELDS).page).toBe(1);
    expect(parseInventoryQuery({ q: ['a', 'b'] }, FIELDS).q).toBe('a');
  });

  it('writes only the values that differ from the defaults', () => {
    expect(inventoryQueryToUrl(DEFAULT_INVENTORY_QUERY)).toEqual({});
    expect(inventoryQueryToUrl({ ...DEFAULT_INVENTORY_QUERY, q: 'nas', status: ['active'], page: 2 }))
      .toEqual({ q: 'nas', status: ['active'], page: '2' });
  });

  it('reads back what it wrote', () => {
    const query = { q: 'nas', sort: 'siteId', dir: 'desc' as const, status: ['deprecated' as const], kind: ['vm', 'vps'], page: 4 };

    expect(parseInventoryQuery(inventoryQueryToUrl(query), FIELDS)).toEqual(query);
  });
});
