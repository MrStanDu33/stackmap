import type { Extension } from '../../shared/contracts/extensions';
import type { ExtensionInventory, InventoryColumn } from '@stackmap/extension-sdk';
import type { Component } from 'vue';
import type { z } from 'zod';

export type InstalledExtension = z.infer<typeof Extension>;

/** The inventory registrations of the built-in extensions (`extensions/<id>/inventory.ts`), in registry order. */
export const BUILTIN_INVENTORIES: readonly ExtensionInventory<Component>[] = [];

/** An entity type the inventory shows: an active extension declares it and registered its form and columns. */
export interface InventoryEntry {
  extension: string;
  entity: string;
  /** `<extension>/<entity>`, as in the inventory's path. */
  key: string;
  /** i18n key of its name, from the extension's manifest. */
  label: string;
  /** i18n key of its plural name: `extensions.<id>.entitiesPlural.<entity>`. */
  plural: string;
  columns: readonly InventoryColumn[];
  form: () => Promise<Component>;
}

/** The inventory's types, in registry order; the first is where `/inventory` leads. */
export function inventoryTypes(
  _extensions: readonly InstalledExtension[],
  _inventories: readonly ExtensionInventory<Component>[] = BUILTIN_INVENTORIES,
): InventoryEntry[] {
  return [];
}

export function findInventoryType(
  _types: readonly InventoryEntry[],
  _extension: string,
  _entity: string,
): InventoryEntry | undefined {
  return undefined;
}
