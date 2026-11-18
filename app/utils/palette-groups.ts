import type { PaletteGroup } from './palette';
import type { Display } from './preferences-sync';
import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { SearchHit } from '../../shared/contracts/search';

/** The entities search found, or where it stands. */
export interface PaletteEntities {
  state: 'idle' | 'loading' | 'failed' | 'done';
  hits: SearchHit[];
}

/** A type of the inventory the palette offers: its page, and New for editors. */
export interface PaletteType {
  extension: string;
  entity: string;
  /** Its name, and its plural, translated. */
  name: string;
  plural: string;
  icon?: string;
}

export interface PaletteContext {
  q: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  /** The current page's path, which a workspace switch keeps. */
  path: string;
  workspace: { slug: string; role: WorkspaceRole } | null;
  workspaces: readonly { name: string; slug: string }[];
  types: readonly PaletteType[];
  display: Display;
  entities: PaletteEntities;
}

/** The palette's groups for what is typed: entities, pages, workspaces and actions. */
export function paletteGroups(_context: PaletteContext): PaletteGroup[] {
  throw new Error('Not implemented');
}
