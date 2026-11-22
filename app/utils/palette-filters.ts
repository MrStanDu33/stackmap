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

/** Every filter the user can choose, with the names that call it up when typed in full. */
function candidates({ t, extensions, types, hidden }: PaletteFilterContext) {
  const groups = (Object.keys(PALETTE_GROUP_STYLES) as (keyof typeof PALETTE_GROUP_STYLES)[])
    .filter((group) => !hidden.includes(`group:${group}`))
    .map((group) => ({
      option: {
        filter: { kind: 'group', group }, name: t(`palette.groupName.${group}`), word: '', ...PALETTE_GROUP_STYLES[group],
      } satisfies PaletteFilterOption,
      names: [t(`palette.groupName.${group}`), t(`palette.groups.${group}`)],
    }));
  const color = PALETTE_GROUP_STYLES.entities.color;
  const byExtension = extensions.filter(({ id }) => !entitiesHidden(hidden, id)).map(({ id, name, icon }) => ({
    option: { filter: { kind: 'extension', extension: id }, name, word: '', ...(icon ? { icon } : {}), color } satisfies PaletteFilterOption,
    names: [id, name],
  }));
  const byType = types.filter(({ extension, entity }) => !entitiesHidden(hidden, extension, entity))
    .map(({ extension, entity, name, plural, icon }) => ({
      option: {
        filter: { kind: 'type', extension, entity }, name, word: '', ...(icon ? { icon } : {}), color,
      } satisfies PaletteFilterOption,
      names: [name, plural],
    }));
  return [...groups, ...byExtension, ...byType];
}

/** Every filter the user can choose: groups, extensions, then entity types, none hidden or turned off. */
export function availableFilters(context: PaletteFilterContext): PaletteFilterOption[] {
  return candidates(context).map(({ option }) => option);
}

/** The filters what is typed names in full: groups, extensions and entity types, in the current language. */
export function paletteFilters(context: PaletteFilterContext): PaletteFilterOption[] {
  const typed = normalize(context.q);
  if (context.filter || !typed) {
    return [];
  }
  const word = context.q.trim();
  return candidates(context)
    .filter(({ names }) => names.some((name) => normalize(name) === typed))
    .map(({ option }) => ({ ...option, word }));
}
