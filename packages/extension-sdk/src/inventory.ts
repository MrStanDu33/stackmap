import type { ExtensionManifest, KindEntity } from './manifest';

const REFERENCE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export const COLUMN_FORMATS = ['text', 'kind', 'reference', 'date', 'boolean', 'number', 'list', 'enum'] as const;
export type ColumnFormat = (typeof COLUMN_FORMATS)[number];

/** A column of an inventory table: a field of the entity, its label, and how its value shows. */
export interface InventoryColumn {
  field: string;
  /** An i18n key under `extensions.<id>.`. */
  label: string;
  format?: ColumnFormat;
  /** For a `reference` column: the entity type it refers to, `<extension>/<entity>`. */
  reference?: string;
  /** For a `kind` column: whose kinds its values are. */
  kind?: KindEntity;
  /** For an `enum` column: the i18n key prefix of its values' labels, `<prefix>.<value>`. */
  labels?: string;
}

/** An entity type in the inventory: its hand-written form, loaded when opened, and its table's columns. */
export interface InventoryType<Form = unknown> {
  entity: string;
  form: () => Promise<Form>;
  /** The first column is the entity's name or main field. */
  columns: readonly InventoryColumn[];
  /**
   * How an entity is named in titles, announcements and reference selects, when its first column does not say it
   * alone: a listener is "<service> :<port>/<transport>". `name` gives a referenced entity's name.
   */
  title?: (entity: Record<string, unknown>, name: (reference: string, id: unknown) => string) => string;
  /** The types its form chooses from beyond its reference columns' (a host's addresses pick a network). */
  references?: readonly string[];
}

export interface ExtensionInventory<Form = unknown> {
  extension: string;
  types: readonly InventoryType<Form>[];
}

/** Ties an extension's inventory types to its manifest; fails when a type or column does not fit it. */
export function defineInventory<Form>(
  manifest: ExtensionManifest,
  types: readonly InventoryType<Form>[],
): ExtensionInventory<Form> {
  const declared = new Set((manifest.contributes.entities ?? []).map(({ id }) => id));
  const prefix = `extensions.${manifest.id}.`;
  const problems = types.flatMap(({ entity, columns }, index) => [
    ...(declared.has(entity) ? [] : [`"${entity}" is not an entity of the manifest`]),
    ...(types.findIndex((other) => other.entity === entity) === index ? [] : [`"${entity}" is listed twice`]),
    ...(columns.length === 0 ? [`"${entity}" has no column`] : []),
    ...columns.flatMap(({ field, label, format, reference, labels }) => [
      ...(label.startsWith(prefix) ? [] : [`"${entity}.${field}": its label ${label} is not under ${prefix}`]),
      ...(format === 'reference' && !REFERENCE.test(reference ?? '')
        ? [`"${entity}.${field}": a reference column needs <extension>/<entity>, not ${reference ?? 'nothing'}`]
        : []),
      ...(format === 'enum' && !labels?.startsWith(prefix)
        ? [`"${entity}.${field}": an enum column needs labels under ${prefix}, not ${labels ?? 'nothing'}`]
        : []),
    ]),
  ]);
  if (problems.length > 0) {
    throw new Error(`Invalid inventory of "${manifest.id}": ${problems.join('; ')}`);
  }
  return { extension: manifest.id, types: Object.freeze([...types]) };
}
