import type { PaletteColor, PaletteFilterOption } from './palette';
import type { PaletteType } from './palette-groups';

/** An extension the palette can filter by: one active and on in the workspace. */
export interface PaletteExtension {
  id: string;
  /** Its name, translated. */
  name: string;
  icon?: string;
}

export interface PaletteFilterContext {
  q: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  extensions: readonly PaletteExtension[];
  types: readonly PaletteType[];
  /** What the user hid in Settings. */
  hidden: readonly string[];
  /** The chip already chosen, if any. */
  filter: PaletteFilterOption | null;
}

/** The palette's groups, in order, with the icon and color that tell them apart. */
export const PALETTE_GROUP_STYLES = {
  entities: { icon: 'i-lucide-box', color: 'primary' },
  pages: { icon: 'i-lucide-file-text', color: 'info' },
  workspaces: { icon: 'i-lucide-folder', color: 'secondary' },
  actions: { icon: 'i-lucide-zap', color: 'warning' },
} as const satisfies Record<string, { icon: string; color: PaletteColor }>;

const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();

/** Whether a type, or an extension's entities, are hidden in Settings: by itself, its extension, or Entities. */
export const entitiesHidden = (hidden: readonly string[], extension: string, entity?: string) =>
  hidden.includes('group:entities') || hidden.includes(`extension:${extension}`)
  || (entity !== undefined && hidden.includes(`type:${extension}/${entity}`));

/** The filters what is typed names in full: groups, extensions and entity types, in the current language. */
export function paletteFilters(context: PaletteFilterContext): PaletteFilterOption[] {
  const { q, t, extensions, types, hidden, filter } = context;
  const typed = normalize(q);
  if (filter || !typed) {
    return [];
  }
  const names = (...candidates: string[]) => candidates.some((candidate) => normalize(candidate) === typed);
  const word = q.trim();
  const groups = (Object.keys(PALETTE_GROUP_STYLES) as (keyof typeof PALETTE_GROUP_STYLES)[])
    .filter((group) => !hidden.includes(`group:${group}`)
      && names(t(`palette.groupName.${group}`), t(`palette.groups.${group}`)))
    .map((group): PaletteFilterOption => ({
      filter: { kind: 'group', group }, name: t(`palette.groupName.${group}`), word, ...PALETTE_GROUP_STYLES[group],
    }));
  const color = PALETTE_GROUP_STYLES.entities.color;
  const byExtension = extensions
    .filter(({ id, name }) => !entitiesHidden(hidden, id) && names(id, name))
    .map(({ id, name, icon }): PaletteFilterOption => ({
      filter: { kind: 'extension', extension: id }, name, word, ...(icon ? { icon } : {}), color,
    }));
  const byType = types
    .filter(({ extension, entity, name, plural }) => !entitiesHidden(hidden, extension, entity) && names(name, plural))
    .map(({ extension, entity, name, icon }): PaletteFilterOption => ({
      filter: { kind: 'type', extension, entity }, name, word, ...(icon ? { icon } : {}), color,
    }));
  return [...groups, ...byExtension, ...byType];
}
