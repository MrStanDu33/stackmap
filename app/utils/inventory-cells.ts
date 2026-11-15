import { endpoint } from '@stackmap/extension-sdk/entities';

import type { Translate } from './traffic-graph';
import type { InventoryColumn, KindEntity } from '@stackmap/extension-sdk';

export interface CellContext {
  t: Translate;
  locale: string;
  /** A referenced entity's name; empty when it is not found. */
  name: (reference: string, id: unknown) => string;
  kindLabel: (entity: KindEntity, kind: string) => string;
}

/** A value as text: entity values are JSON. */
export const valueText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return value === null || value === undefined ? '' : JSON.stringify(value);
};

/** The text a table cell shows for an entity's field, in the interface's language. */
export function cellText(entity: Record<string, unknown>, column: InventoryColumn, context: CellContext): string {
  const value = entity[column.field];
  if (value === null || value === undefined) {
    return '';
  }
  switch (column.format) {
    case 'reference':
      return context.name(column.reference ?? '', value) || context.t('inventory.unknown');
    case 'kind':
      return column.kind ? context.kindLabel(column.kind, valueText(value)) : valueText(value);
    case 'enum':
      return context.t(`${column.labels ?? ''}.${valueText(value)}`);
    case 'list':
      // A host's addresses: each item's first text, its address.
      return (value as unknown[]).map((item) => (typeof item === 'object' && item
        ? valueText(Object.values(item).find((part) => typeof part === 'string'))
        : valueText(item))).join(', ');
    case 'number':
      return typeof value === 'number' ? new Intl.NumberFormat(context.locale).format(value) : valueText(value);
    case 'endpoint': {
      // A port is an identifier: not grouped by the locale, as a number column would be.
      const port = entity[column.port ?? ''];
      return endpoint(valueText(value), typeof port === 'number' ? port : null);
    }
    case 'boolean':
      return context.t(value === true ? 'inventory.yes' : 'inventory.no');
    case 'date':
      return new Intl.DateTimeFormat(context.locale, { dateStyle: 'medium' }).format(new Date(valueText(value)));
    default:
      return valueText(value);
  }
}
