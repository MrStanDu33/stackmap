import { describe, expect, it } from 'vitest';

import { cellText } from './inventory-cells';
import { createTestI18n } from '../../tests/support/i18n';

import type { CellContext } from './inventory-cells';
import type { InventoryColumn } from '@stackmap/extension-sdk';

const contextFor = (locale: 'en' | 'fr'): CellContext => {
  const { global: i18n } = createTestI18n(locale);
  return {
    t: (key, params) => i18n.t(key, params ?? {}),
    locale,
    name: (reference, id) => (reference === 'core/site' && id === 's1' ? 'Home' : ''),
    kindLabel: (entity, kind) => (entity === 'host' && kind === 'vm' ? 'Virtual machine' : kind),
  };
};

const column = (field: string, extra: Partial<InventoryColumn> = {}): InventoryColumn => ({
  field, label: `extensions.core.fields.host.${field}`, ...extra,
});

describe('cellText', () => {
  it('translates an enum column by its labels prefix: a DNS view, a transport (review)', () => {
    const view = column('view', { format: 'enum', labels: 'extensions.core.dnsViews' });

    expect(cellText({ view: 'internal' }, view, contextFor('fr'))).toBe(contextFor('fr').t('extensions.core.dnsViews.internal'));
    expect(cellText({ view: 'internal' }, view, contextFor('fr'))).not.toBe('internal');
    expect(cellText({ transport: 'udp' }, column('transport', { format: 'enum', labels: 'extensions.core.transports' }), contextFor('en'))).toBe('UDP');
  });

  it('names a reference, Unknown when it is not found, nothing when it is empty', () => {
    const site = column('siteId', { format: 'reference', reference: 'core/site' });
    const en = contextFor('en');

    expect(cellText({ siteId: 's1' }, site, en)).toBe('Home');
    expect(cellText({ siteId: 's9' }, site, en)).toBe(en.t('inventory.unknown'));
    expect(cellText({ siteId: null }, site, en)).toBe('');
  });

  it('translates a kind, lists a list\'s items by their first text, formats numbers in the locale', () => {
    const fr = contextFor('fr');

    expect(cellText({ kind: 'vm' }, column('kind', { format: 'kind', kind: 'host' }), fr)).toBe('Virtual machine');
    expect(cellText({ addresses: [{ address: '192.0.2.10', networkId: null }, { address: '192.0.2.11' }] }, column('addresses', { format: 'list' }), fr))
      .toBe('192.0.2.10, 192.0.2.11');
    expect(cellText({ port: 8443 }, column('port', { format: 'number' }), fr)).toBe(new Intl.NumberFormat('fr').format(8443));
  });

  it('shows an endpoint column as <address>:<port>, an IPv6 address in brackets (4)', () => {
    const external = column('externalAddress', { format: 'endpoint', port: 'externalPort' });
    const en = contextFor('en');

    expect(cellText({ externalAddress: '203.0.113.10', externalPort: 443 }, external, en)).toBe('203.0.113.10:443');
    expect(cellText({ externalAddress: '2001:db8::1', externalPort: 443 }, external, en)).toBe('[2001:db8::1]:443');
    // Not grouped by the locale: a port is an identifier, not a quantity.
    expect(cellText({ externalAddress: '203.0.113.10', externalPort: 51820 }, external, contextFor('fr'))).toBe('203.0.113.10:51820');
  });

  it('shows an endpoint without port as its address alone, and nothing without address (4)', () => {
    const external = column('externalAddress', { format: 'endpoint', port: 'externalPort' });
    const en = contextFor('en');

    expect(cellText({ externalAddress: '203.0.113.10', externalPort: null }, external, en)).toBe('203.0.113.10');
    expect(cellText({ externalAddress: null, externalPort: 443 }, external, en)).toBe('');
  });
});
