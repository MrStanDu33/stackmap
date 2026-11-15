import { describe, expect, it } from 'vitest';

import { defineInventory } from './inventory';
import { defineExtension } from './manifest';

import type { InventoryType } from './inventory';

const manifest = defineExtension({
  id: 'reverse-proxy',
  version: '1.0.0',
  apiVersion: 1,
  name: 'extensions.reverse-proxy.name',
  description: 'extensions.reverse-proxy.description',
  contributes: {
    entities: [
      { id: 'route', table: 'reverse_proxy_route', label: 'extensions.reverse-proxy.entities.route' },
      { id: 'certificate', table: 'reverse_proxy_certificate', label: 'extensions.reverse-proxy.entities.certificate' },
    ],
  },
});

const form = () => Promise.resolve('RouteForm');

const route = (overrides: Partial<InventoryType<string>> = {}): InventoryType<string> => ({
  entity: 'route',
  form,
  columns: [
    { field: 'hostnames', label: 'extensions.reverse-proxy.fields.route.hostnames', format: 'list' },
    {
      field: 'upstreamListenerId',
      label: 'extensions.reverse-proxy.fields.route.upstreamListenerId',
      format: 'reference',
      reference: 'core/listener',
    },
  ],
  ...overrides,
});

describe('defineInventory', () => {
  it('returns the extension id with its inventory types, each with a lazy form and its columns', async () => {
    const inventory = defineInventory(manifest, [route()]);

    expect(inventory.extension).toBe('reverse-proxy');
    expect(inventory.types.map(({ entity }) => entity)).toEqual(['route']);
    expect(inventory.types[0]?.columns).toEqual(route().columns);
    await expect(inventory.types[0]?.form()).resolves.toBe('RouteForm');
  });

  it('refuses a type whose entity is not in the manifest', () => {
    expect(() => defineInventory(manifest, [route({ entity: 'tunnel' })])).toThrow(/tunnel/);
  });

  it('refuses a type listed twice', () => {
    expect(() => defineInventory(manifest, [route(), route()])).toThrow(/route/);
  });

  it('refuses a column label outside extensions.<id>.', () => {
    expect(() => defineInventory(manifest, [route({
      columns: [{ field: 'hostnames', label: 'extensions.core.fields.host.name' }],
    })])).toThrow(/extensions\.core\.fields\.host\.name/);
  });

  it('refuses a reference column without a reference, or with one that is not <extension>/<entity>', () => {
    const label = 'extensions.reverse-proxy.fields.route.upstreamListenerId';
    expect(() => defineInventory(manifest, [route({
      columns: [{ field: 'upstreamListenerId', label, format: 'reference' }],
    })])).toThrow(/upstreamListenerId/);
    expect(() => defineInventory(manifest, [route({
      columns: [{ field: 'upstreamListenerId', label, format: 'reference', reference: 'listener' }],
    })])).toThrow(/listener/);
  });

  it('refuses an enum column without labels, or with labels outside extensions.<id>. (review)', () => {
    const label = 'extensions.reverse-proxy.fields.route.forceSsl';
    expect(() => defineInventory(manifest, [route({ columns: [{ field: 'forceSsl', label, format: 'enum' }] })])).toThrow(/forceSsl/);
    expect(() => defineInventory(manifest, [route({
      columns: [{ field: 'forceSsl', label, format: 'enum', labels: 'extensions.core.transports' }],
    })])).toThrow(/extensions\.core\.transports/);
    expect(defineInventory(manifest, [route({
      columns: [{ field: 'forceSsl', label, format: 'enum', labels: 'extensions.reverse-proxy.ssl' }],
    })]).types[0]?.columns[0]?.labels).toBe('extensions.reverse-proxy.ssl');
  });

  it('accepts enum labels under a dependency\'s prefix, not under another extension\'s (review)', () => {
    const dependent = defineExtension({ ...manifest, dependsOn: ['core'] });
    const label = 'extensions.reverse-proxy.fields.route.transport';
    const transport = (labels: string) => route({ columns: [{ field: 'transport', label, format: 'enum', labels }] });

    expect(defineInventory(dependent, [transport('extensions.core.transports')]).types[0]?.columns[0]?.labels)
      .toBe('extensions.core.transports');
    expect(() => defineInventory(dependent, [transport('extensions.nat.transports')])).toThrow(/extensions\.nat\.transports/);
  });

  it('refuses a type without columns', () => {
    expect(() => defineInventory(manifest, [route({ columns: [] })])).toThrow(/route/);
  });

  it('refuses an endpoint column without the field holding its port', () => {
    const label = 'extensions.reverse-proxy.fields.route.upstream';
    expect(() => defineInventory(manifest, [route({ columns: [{ field: 'upstream', label, format: 'endpoint' }] })])).toThrow(/upstream/);
    expect(defineInventory(manifest, [route({
      columns: [{ field: 'upstream', label, format: 'endpoint', port: 'upstreamPort' }],
    })]).types[0]?.columns[0]?.port).toBe('upstreamPort');
  });
});
