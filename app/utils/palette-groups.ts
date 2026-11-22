import type { PaletteGroup } from './palette';
import type { Display } from './preferences-sync';
import type { WorkspaceRole } from '../../shared/contracts/contract';
import type { SearchHit } from '../../shared/contracts/search';

import { APP_LOCALES } from '#shared/i18n/locales';

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
  /** The current page's query, which selecting an entity there keeps. */
  query: Readonly<Record<string, string>>;
  /** What the current page draws: an entity's id to its `?selected=` value there. */
  drawn: Readonly<Record<string, string>>;
  /** What the user hid in Settings: `group:<id>` keys. */
  hidden: readonly string[];
}

// One or more labels, then a top-level label of letters: what a hostname looks like.
const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** The palette's groups for what is typed: entities, pages, workspaces and actions. */
export function paletteGroups(context: PaletteContext): PaletteGroup[] {
  const { q, t, path, workspace, workspaces, types, display, entities, query, drawn, hidden } = context;
  const typed = q.trim() !== '';
  const base = workspace ? `/w/${workspace.slug}` : '';
  const navigate = (to: string) => ({ kind: 'navigate' as const, to });
  const typeOf = (extension: string, entity: string) =>
    types.find((type) => type.extension === extension && type.entity === entity);

  const found: PaletteGroup = {
    id: 'entities',
    label: t('palette.groups.entities'),
    icon: 'i-lucide-box',
    color: 'primary',
    searched: true,
    items: entities.state === 'done'
      ? entities.hits.map(({ extension, entity, id, title }) => ({
          id: `${extension}/${entity}/${id}`,
          label: title,
          description: typeOf(extension, entity)?.name ?? t('palette.unknownType'),
          icon: typeOf(extension, entity)?.icon ?? 'i-lucide-box',
          // Selected where the page draws it; opened in the inventory otherwise.
          command: navigate(Object.hasOwn(drawn, id)
            ? `${path}?${new URLSearchParams({ ...query, selected: drawn[id] ?? '' }).toString()}`
            : `${base}/inventory/${extension}/${entity}?open=${encodeURIComponent(id)}`),
        }))
      : [],
    ...(entities.state === 'loading' ? { message: t('palette.searching') } : {}),
    ...(entities.state === 'failed' ? { message: t('palette.failed'), failed: true } : {}),
  };

  const page = (id: string, label: string, to: string, icon: string) => ({ id, label, icon, command: navigate(to) });
  const pages: PaletteGroup = {
    id: 'pages',
    label: t('palette.groups.pages'),
    icon: 'i-lucide-file-text',
    color: 'info',
    items: [
      ...(workspace
        ? [
            page('traffic', t('traffic.title'), `${base}/graph`, 'i-lucide-waypoints'),
            page('trace', t('trace.title'), `${base}/trace`, 'i-lucide-route'),
            page('inventory', t('inventory.title'), `${base}/inventory`, 'i-lucide-boxes'),
            ...types.map((type) => page(
              `inventory/${type.extension}/${type.entity}`, type.plural,
              `${base}/inventory/${type.extension}/${type.entity}`, type.icon ?? 'i-lucide-boxes',
            )),
            page('members', t('members.title'), `${base}/members`, 'i-lucide-users'),
            page('extensions', t('workspaceExtensions.title'), `${base}/extensions`, 'i-lucide-puzzle'),
          ]
        : []),
      page('settings', t('settings.title'), '/settings', 'i-lucide-settings'),
    ],
  };

  // The same page in another workspace: its path past the slug.
  const rest = workspace ? path.slice(base.length) : '/graph';
  const others: PaletteGroup = {
    id: 'workspaces',
    label: t('palette.groups.workspaces'),
    icon: 'i-lucide-folder',
    color: 'secondary',
    items: workspaces.filter(({ slug }) => slug !== workspace?.slug)
      .map(({ name, slug }) => ({ id: slug, label: name, icon: 'i-lucide-folder', command: navigate(`/w/${slug}${rest}`) })),
  };

  const hostname = q.trim().toLowerCase();
  const canEdit = workspace !== null && workspace.role !== 'viewer';
  const theme = display.theme === 'dark' ? 'light' : 'dark';
  const contrast = display.contrast === 'strict' ? 'standard' : 'strict';
  const locale = APP_LOCALES.find(({ code }) => code !== display.locale) ?? APP_LOCALES[0];
  const actions: PaletteGroup = {
    id: 'actions',
    label: t('palette.groups.actions'),
    icon: 'i-lucide-zap',
    color: 'warning',
    items: [
      ...(workspace && HOSTNAME.test(hostname)
        ? [{
            id: 'trace', label: t('palette.actions.trace', { hostname }), icon: 'i-lucide-route',
            command: navigate(`${base}/trace?hostname=${encodeURIComponent(hostname)}`),
          }]
        : []),
      ...(canEdit
        ? types.map((type) => ({
            id: `new/${type.extension}/${type.entity}`,
            label: t('inventory.new', { type: type.name }),
            icon: 'i-lucide-plus',
            command: navigate(`${base}/inventory/${type.extension}/${type.entity}?new=1`),
          }))
        : []),
      {
        id: 'theme', label: t(theme === 'light' ? 'palette.actions.themeLight' : 'palette.actions.themeMidnight'),
        icon: theme === 'light' ? 'i-lucide-sun' : 'i-lucide-moon', command: { kind: 'display', changes: { theme } },
      },
      {
        id: 'contrast', label: t(contrast === 'strict' ? 'palette.actions.contrastStrict' : 'palette.actions.contrastStandard'),
        icon: 'i-lucide-contrast', command: { kind: 'display', changes: { contrast } },
      },
      ...(locale
        ? [{
            id: 'language', label: t('palette.actions.language', { value: locale.name }), icon: 'i-lucide-languages',
            foreign: { text: locale.name, lang: locale.language },
            command: { kind: 'display' as const, changes: { locale: locale.code as Display['locale'] } },
          }]
        : []),
      { id: 'sign-out', label: t('auth.signOut'), icon: 'i-lucide-log-out', command: { kind: 'signOut' } },
    ],
  };

  // Everything hidden: the palette says why it shows nothing, and where to change it.
  if (['entities', 'pages', 'workspaces', 'actions'].every((id) => hidden.includes(`group:${id}`))) {
    return [{
      id: 'hidden',
      label: t('settings.title'),
      icon: 'i-lucide-eye-off',
      message: t('palette.allHidden'),
      items: [page('settings', t('palette.openSettings'), '/settings', 'i-lucide-settings')],
    }];
  }
  return [...(typed ? [found] : []), pages, ...(others.items.length > 0 ? [others] : []), actions]
    .filter(({ id }) => !hidden.includes(`group:${id}`));
}
