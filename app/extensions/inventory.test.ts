import { describe, expect, it } from 'vitest';

import { BUILTIN_INVENTORIES, findInventoryType, inventoryTypes } from './inventory';
import core from '../../extensions/core/manifest';
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
