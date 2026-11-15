import { describe, expect, it } from 'vitest';

import { BUILTIN_INVENTORIES, findInventoryType, inventoryTypes } from './inventory';
import core from '../../extensions/core/manifest';
import natInventory from '../../extensions/nat/app/inventory';
import proxyInventory from '../../extensions/reverse-proxy/app/inventory';
import { createTestI18n } from '../../tests/support/i18n';

import type { InstalledExtension } from './inventory';
import type { ExtensionInventory } from '@stackmap/extension-sdk';
import type { Component } from 'vue';

const installed = (id: string, entities: string[], state: 'active' | 'failed' = 'active'): InstalledExtension => ({
  id,
  version: '1.0.0',
  name: `extensions.${id}.name`,
  description: `extensions.${id}.description`,
  alwaysOn: id === 'core',
  dependsOn: [],
  state,
  enabled: true,
  kinds: { host: [], network: [], service: [], protocol: [] },
  entities: entities.map((entity) => ({ id: entity, label: `extensions.${id}.entities.${entity}` })),
  locales: [],
});

const registration = (extension: string, entities: string[]): ExtensionInventory<Component> => ({
  extension,
  types: entities.map((entity) => ({
    entity,
    form: () => Promise.resolve({} as Component),
    columns: [{ field: 'name', label: `extensions.${extension}.fields.${entity}.name` }],
  })),
});

describe('built-in inventory registrations', () => {
  it('registers the 8 core types, in the manifest order', () => {
    const coreTypes = BUILTIN_INVENTORIES.find(({ extension }) => extension === 'core')?.types ?? [];

    expect(coreTypes.map(({ entity }) => entity)).toEqual((core.contributes.entities ?? []).map(({ id }) => id));
  });

  it('registers NAT\'s port forwards after the core\'s types (1)', () => {
    expect(BUILTIN_INVENTORIES.map(({ extension }) => extension).slice(0, 2)).toEqual(['core', 'nat']);
    expect(BUILTIN_INVENTORIES[1]?.types.map(({ entity }) => entity)).toEqual(['port-forward']);
  });

  it('shows a port forward\'s host, endpoints, transport and description, sorted by host (3)', () => {
    const [type] = natInventory.types;

    expect(type?.columns.map(({ field, format, reference, port }) => ({ field, format, reference, port }))).toEqual([
      { field: 'hostId', format: 'reference', reference: 'core/host', port: undefined },
      { field: 'externalAddress', format: 'endpoint', reference: undefined, port: 'externalPort' },
      { field: 'transport', format: 'enum', reference: undefined, port: undefined },
      { field: 'internalAddress', format: 'endpoint', reference: undefined, port: 'internalPort' },
      { field: 'description', format: undefined, reference: undefined, port: undefined },
    ]);
  });

  it('names a port forward "<host> <external>/<transport>" (8)', () => {
    const [type] = natInventory.types;
    const name = (reference: string, id: unknown) => (reference === 'core/host' && id === 'h1' ? 'Edge router' : '');
    const forward = { hostId: 'h1', externalAddress: '203.0.113.10', externalPort: 443, transport: 'tcp' };

    expect(type?.title?.(forward, name)).toBe('Edge router 203.0.113.10:443/tcp');
    expect(type?.title?.({ ...forward, externalAddress: '2001:db8::1' }, name)).toBe('Edge router [2001:db8::1]:443/tcp');
    // A row without its port, which the server never sends: the address alone, not "NaN" (review).
    expect(type?.title?.({ ...forward, externalPort: null }, name)).toBe('Edge router 203.0.113.10/tcp');
  });

  it('labels the transports with the core\'s labels, as the listener does (review)', () => {
    expect(natInventory.types[0]?.columns.find(({ field }) => field === 'transport')?.labels).toBe('extensions.core.transports');
  });

  it('registers the reverse proxy\'s routes after NAT\'s types (1)', () => {
    expect(BUILTIN_INVENTORIES.map(({ extension }) => extension)).toEqual(['core', 'nat', 'reverse-proxy']);
    expect(BUILTIN_INVENTORIES[2]?.types.map(({ entity }) => entity)).toEqual(['route']);
  });

  it('shows a route\'s hostnames, proxy, upstream, Force SSL and WebSockets, sorted by hostnames (2)', () => {
    const columns = proxyInventory.types[0]?.columns ?? [];
    expect(columns.map(({ field, format, reference }) => ({ field, format, reference }))).toEqual([
      { field: 'hostnames', format: 'list', reference: undefined },
      { field: 'proxyServiceId', format: 'reference', reference: 'core/service' },
      { field: 'upstreamListenerId', format: 'reference', reference: 'core/listener' },
      { field: 'forceSsl', format: 'boolean', reference: undefined },
      { field: 'websockets', format: 'boolean', reference: undefined },
    ]);
  });

  it('names a route "<proxy> → <first hostname>", with " (+N)" for the others (4)', () => {
    const [type] = proxyInventory.types;
    const name = (reference: string, id: unknown) => (reference === 'core/service' && id === 'p1' ? 'NPM' : '');
    const route = { proxyServiceId: 'p1', hostnames: ['blog.homelab.example'] };

    expect(type?.title?.(route, name)).toBe('NPM → blog.homelab.example');
    const three = ['blog.homelab.example', 'www.blog.homelab.example', 'b.homelab.example'];
    expect(type?.title?.({ ...route, hostnames: three }, name))
      .toBe('NPM → blog.homelab.example (+2)');
    // A proxy the user cannot see: its hostnames alone, not "→ blog…".
    expect(type?.title?.({ ...route, proxyServiceId: 'p9' }, name)).toBe('blog.homelab.example');
  });

  it('translates every column label and every type\'s plural name in English and French', () => {
    expect(BUILTIN_INVENTORIES.length).toBeGreaterThan(0);
    for (const locale of ['en', 'fr'] as const) {
      const { global: i18n } = createTestI18n(locale);
      const te = (key: string, on: 'en' | 'fr') => i18n.te(key, on);
      const keys = BUILTIN_INVENTORIES.flatMap(({ extension, types }) => types.flatMap(({ entity, columns }) => [
        `extensions.${extension}.entitiesPlural.${entity}`, ...columns.map(({ label }) => label),
      ]));
      expect({ locale, missing: keys.filter((key) => !te(key, locale)) }).toEqual({ locale, missing: [] });
    }
  });
});

describe('inventoryTypes', () => {
  const extensions = [installed('core', ['site', 'host']), installed('nat', ['port-forward'])];
  const inventories = [registration('core', ['site', 'host']), registration('nat', ['port-forward'])];

  it('lists a type when an active extension declares it and has a registration, in registry order', () => {
    const types = inventoryTypes(extensions, inventories);

    expect(types.map(({ key }) => key)).toEqual(['core/site', 'core/host', 'nat/port-forward']);
    expect(types[1]).toMatchObject({
      extension: 'core',
      entity: 'host',
      label: 'extensions.core.entities.host',
      plural: 'extensions.core.entitiesPlural.host',
      columns: [{ field: 'name', label: 'extensions.core.fields.host.name' }],
    });
  });

  it('leaves out a type a failed extension declares, and a declared type without a registration', () => {
    const types = inventoryTypes(
      [installed('core', ['site', 'host', 'flow']), installed('nat', ['port-forward'], 'failed')],
      inventories,
    );

    expect(types.map(({ key }) => key)).toEqual(['core/site', 'core/host']);
  });

  it('gives the first type for /inventory to redirect to: core/site', () => {
    expect(inventoryTypes(extensions, inventories)[0]?.key).toBe('core/site');
  });

  it('finds no type for an unknown extension or entity', () => {
    const types = inventoryTypes(extensions, inventories);

    expect(findInventoryType(types, 'core', 'host')?.key).toBe('core/host');
    expect(findInventoryType(types, 'vpn', 'host')).toBeUndefined();
    expect(findInventoryType(types, 'core', 'tunnel')).toBeUndefined();
  });
});
