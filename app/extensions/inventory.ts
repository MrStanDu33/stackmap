import coreInventory from '@stackmap/extension-core/inventory';
import natInventory from '@stackmap/extension-nat/inventory';
import proxyInventory from '@stackmap/extension-reverse-proxy/inventory';

import type { InstalledExtension as Installed } from '../../shared/contracts/extensions';
import type { ExtensionInventory, InventoryColumn, InventoryType } from '@stackmap/extension-sdk';
import type { Component } from 'vue';

/** An installed extension; `enabled` is false when it is turned off in the workspace. */
export type InstalledExtension = Installed & { enabled?: boolean };

/** The inventory registrations of the built-in extensions (`extensions/<id>/inventory.ts`), in registry order. */
export const BUILTIN_INVENTORIES: readonly ExtensionInventory<Component>[] = [
  coreInventory, natInventory, proxyInventory,
];

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
  title?: InventoryType<Component>['title'];
  /** The types its form and table choose from or name: its reference columns' and its form's own. */
  references: readonly string[];
}

/** The inventory's types, in registry order; the first is where `/inventory` leads. */
export function inventoryTypes(
  extensions: readonly InstalledExtension[],
  inventories: readonly ExtensionInventory<Component>[] = BUILTIN_INVENTORIES,
): InventoryEntry[] {
  return extensions.filter(({ state, enabled }) => state === 'active' && enabled !== false).flatMap((extension) => {
    const registered = inventories.find((inventory) => inventory.extension === extension.id)?.types ?? [];
    return extension.entities.flatMap(({ id, label }) => {
      const type = registered.find(({ entity }) => entity === id);
      return type
        ? [{
            extension: extension.id,
            entity: id,
            key: `${extension.id}/${id}`,
            label,
            plural: `extensions.${extension.id}.entitiesPlural.${id}`,
            columns: type.columns,
            form: type.form,
            ...(type.title ? { title: type.title } : {}),
            references: [...new Set([
              ...type.columns.flatMap(({ reference }) => (reference ? [reference] : [])),
              ...(type.references ?? []),
            ])],
          }]
        : [];
    });
  });
}

export function findInventoryType(
  types: readonly InventoryEntry[],
  extension: string,
  entity: string,
): InventoryEntry | undefined {
  return types.find((type) => type.extension === extension && type.entity === entity);
}
