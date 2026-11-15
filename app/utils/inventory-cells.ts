import type { Translate } from './traffic-graph';
import type { InventoryColumn, KindEntity } from '@stackmap/extension-sdk';

export interface CellContext {
  t: Translate;
  locale: string;
  /** A referenced entity's name; empty when it is not found. */
  name: (reference: string, id: unknown) => string;
  kindLabel: (entity: KindEntity, kind: string) => string;
}

/** The text a table cell shows for an entity's field, in the interface's language. */
export function cellText(_entity: Record<string, unknown>, _column: InventoryColumn, _context: CellContext): string {
  throw new Error('Not implemented');
}
