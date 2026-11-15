import type { ExtensionManifest } from './manifest';

export const COLUMN_FORMATS = ['text', 'kind', 'reference', 'date', 'boolean', 'number', 'list'] as const;
export type ColumnFormat = (typeof COLUMN_FORMATS)[number];

/** A column of an inventory table: a field of the entity, its label, and how its value shows. */
export interface InventoryColumn {
  field: string;
  /** An i18n key under `extensions.<id>.`. */
  label: string;
  format?: ColumnFormat;
  /** For a `reference` column: the entity type it refers to, `<extension>/<entity>`. */
  reference?: string;
}

/** An entity type in the inventory: its hand-written form, loaded when opened, and its table's columns. */
export interface InventoryType<Form = unknown> {
  entity: string;
  form: () => Promise<Form>;
  /** The first column is the entity's name or main field. */
  columns: readonly InventoryColumn[];
}

export interface ExtensionInventory<Form = unknown> {
  extension: string;
  types: readonly InventoryType<Form>[];
}

/** Ties an extension's inventory types to its manifest; fails when a type or column does not fit it. */
export function defineInventory<Form>(
  _manifest: ExtensionManifest,
  _types: readonly InventoryType<Form>[],
): ExtensionInventory<Form> {
  throw new Error('Not implemented');
}
