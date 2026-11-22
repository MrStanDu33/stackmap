import { describe, expect, it } from 'vitest';

import { paletteGroups } from './palette-groups';
import { createTestI18n } from '../../tests/support/i18n';

import type { PaletteContext } from './palette-groups';

const { global: i18n } = createTestI18n('en');
const t = (key: string, params: Record<string, unknown> = {}) => i18n.t(key, params);

const HOST_ID = '0199d6a0-0000-7000-8000-000000000002';

const context = (overrides: Partial<PaletteContext> = {}): PaletteContext => ({
  q: '',
  t,
  path: '/w/home/graph',
  workspace: { slug: 'home', role: 'editor' },
  workspaces: [{ name: 'Home', slug: 'home' }, { name: 'Lab', slug: 'lab' }],
  types: [
    { extension: 'core', entity: 'host', name: 'Host', plural: 'Hosts', icon: 'i-lucide-layers' },
    {
      extension: 'nat', entity: 'port-forward', name: 'Port forward', plural: 'Port forwards', icon: 'i-lucide-arrow-right-left',
    },
  ],
  display: { theme: 'dark', contrast: 'standard', locale: 'en' },
  entities: { state: 'idle', hits: [] },
  query: {},
  drawn: {},
  hidden: [],
  ...overrides,
});

const group = (groups: ReturnType<typeof paletteGroups>, id: string) => groups.find((candidate) => candidate.id === id);
const labels = (groups: ReturnType<typeof paletteGroups>, id: string) =>
  group(groups, id)?.items.map(({ label }) => label);

describe('paletteGroups', () => {
  it('given an empty search, lists pages, workspaces and actions, and no entities (3)', () => {
    expect(paletteGroups(context()).map(({ id }) => id)).toEqual(['pages', 'workspaces', 'actions']);
  });

  it('given a search, lists every group, entities first, the others left to the palette to match on their words (3)', () => {
    const groups = paletteGroups(context({ q: 'router', entities: { state: 'done', hits: [] } }));

    expect(groups.map(({ id }) => id)).toEqual(['entities', 'pages', 'workspaces', 'actions']);
    expect(groups.map(({ searched }) => Boolean(searched))).toEqual([true, false, false, false]);
  });

  it('lists the found entities with their type\'s icon, their title and their type\'s name (4)', () => {
    const groups = paletteGroups(context({
      q: 'router',
      entities: { state: 'done', hits: [{ extension: 'core', entity: 'host', id: HOST_ID, title: 'Edge router', matched: 'name' }] },
    }));

    expect(group(groups, 'entities')?.items).toEqual([{
      id: `core/host/${HOST_ID}`,
      label: 'Edge router',
      description: 'Host',
      icon: 'i-lucide-layers',
      command: { kind: 'navigate', to: `/w/home/inventory/core/host?open=${HOST_ID}` },
    }]);
  });

  it('names the type of an entity whose type is not offered in words, never by its id (4, review)', () => {
    const groups = paletteGroups(context({
      q: 'router',
      entities: { state: 'done', hits: [{ extension: 'old', entity: 'gone-type', id: HOST_ID, title: 'Edge router', matched: 'name' }] },
    }));

    expect(group(groups, 'entities')?.items[0]).toMatchObject({ description: t('palette.unknownType'), icon: 'i-lucide-box' });
  });

  it('given an entity the current page draws, selects it there, keeping the page\'s query (9, 10)', () => {
    const groups = paletteGroups(context({
      q: 'router',
      path: '/w/home/trace',
      query: { hostname: 'app.homelab.example', selected: 'client' },
      drawn: { [HOST_ID]: 'step:a:client' },
      entities: { state: 'done', hits: [{ extension: 'core', entity: 'host', id: HOST_ID, title: 'Edge router', matched: 'name' }] },
    }));

    expect(group(groups, 'entities')?.items[0]?.command)
      .toEqual({ kind: 'navigate', to: '/w/home/trace?hostname=app.homelab.example&selected=step%3Aa%3Aclient' });
  });

  it('given an entity the page does not draw, opens it in the inventory with ?open=<id> (11)', () => {
    const groups = paletteGroups(context({
      q: 'router',
      drawn: { other: 'host:other' },
      entities: { state: 'done', hits: [{ extension: 'core', entity: 'host', id: HOST_ID, title: 'Edge router', matched: 'name' }] },
    }));

    expect(group(groups, 'entities')?.items[0]?.command)
      .toEqual({ kind: 'navigate', to: `/w/home/inventory/core/host?open=${HOST_ID}` });
  });

  it('never takes an inherited property for something the page draws (review)', () => {
    const groups = paletteGroups(context({
      q: 'router',
      entities: { state: 'done', hits: [{ extension: 'core', entity: 'host', id: 'constructor', title: 'Odd', matched: 'name' }] },
    }));

    expect(group(groups, 'entities')?.items[0]?.command)
      .toEqual({ kind: 'navigate', to: '/w/home/inventory/core/host?open=constructor' });
  });

  it('leaves out the groups the user hid in Settings, entities included (13)', () => {
    const groups = paletteGroups(context({ q: 'router', entities: { state: 'done', hits: [] }, hidden: ['group:entities', 'group:pages'] }));

    expect(groups.map(({ id }) => id)).toEqual(['workspaces', 'actions']);
  });

  it('says the entities are being searched, or that the search failed, in the entities group alone (4)', () => {
    expect(group(paletteGroups(context({ q: 'router', entities: { state: 'loading', hits: [] } })), 'entities'))
      .toMatchObject({ items: [], message: t('palette.searching') });
    expect(group(paletteGroups(context({ q: 'router', entities: { state: 'failed', hits: [] } })), 'entities'))
      .toMatchObject({ items: [], message: t('palette.failed'), failed: true });
    expect(group(paletteGroups(context({ q: 'router', entities: { state: 'failed', hits: [] } })), 'pages')?.message)
      .toBeUndefined();
  });

  it('lists Traffic, Trace, Inventory, each enabled type\'s inventory page, Members, Extensions and Settings (5)', () => {
    const pages = group(paletteGroups(context()), 'pages')?.items ?? [];

    expect(pages.map(({ label }) => label)).toEqual([
      t('traffic.title'), t('trace.title'), t('inventory.title'), 'Hosts', 'Port forwards',
      t('members.title'), t('workspaceExtensions.title'), t('settings.title'),
    ]);
    expect(pages.map(({ command }) => command)).toEqual([
      '/w/home/graph', '/w/home/trace', '/w/home/inventory', '/w/home/inventory/core/host',
      '/w/home/inventory/nat/port-forward', '/w/home/members', '/w/home/extensions', '/settings',
    ].map((to) => ({ kind: 'navigate', to })));
  });

  it('leaves out the pages of a workspace without one, and the workspaces group too (5, 6)', () => {
    const groups = paletteGroups(context({ workspace: null, workspaces: [], path: '/settings' }));

    expect(labels(groups, 'pages')).toEqual([t('settings.title')]);
    expect(group(groups, 'workspaces')).toBeUndefined();
  });

  it('lists the user\'s other workspaces, each opening the same page there (6)', () => {
    const items = group(paletteGroups(context({ path: '/w/home/inventory/core/host' })), 'workspaces')?.items;

    expect(items).toEqual([expect.objectContaining({
      label: 'Lab', command: { kind: 'navigate', to: '/w/lab/inventory/core/host' },
    })]);
  });

  it('offers New <type> for each enabled type to editors and up, and to no viewer (7)', () => {
    const news = (role: 'viewer' | 'editor') => group(paletteGroups(context({ workspace: { slug: 'home', role } })), 'actions')
      ?.items.filter(({ command }) => command?.kind === 'navigate').map(({ label, command }) => ({ label, command }));

    expect(news('editor')).toEqual([
      { label: t('inventory.new', { type: 'Host' }), command: { kind: 'navigate', to: '/w/home/inventory/core/host?new=1' } },
      { label: t('inventory.new', { type: 'Port forward' }), command: { kind: 'navigate', to: '/w/home/inventory/nat/port-forward?new=1' } },
    ]);
    expect(news('viewer')).toEqual([]);
  });

  it('offers the theme, contrast and language switches, each saying what it does; the language in its own (7, review)', () => {
    const switches = (display: PaletteContext['display']) => group(paletteGroups(context({ display })), 'actions')
      ?.items.filter(({ command }) => command?.kind === 'display').map(({ label, foreign, command }) => ({ label, foreign, command }));

    expect(switches({ theme: 'dark', contrast: 'standard', locale: 'en' })).toEqual([
      { label: t('palette.actions.themeLight'), foreign: undefined, command: { kind: 'display', changes: { theme: 'light' } } },
      { label: t('palette.actions.contrastStrict'), foreign: undefined, command: { kind: 'display', changes: { contrast: 'strict' } } },
      {
        label: t('palette.actions.language', { value: 'Français' }),
        foreign: { text: 'Français', lang: 'fr-FR' },
        command: { kind: 'display', changes: { locale: 'fr' } },
      },
    ]);
    expect(switches({ theme: 'light', contrast: 'strict', locale: 'fr' })?.map(({ label }) => label)).toEqual([
      t('palette.actions.themeMidnight'), t('palette.actions.contrastStandard'), t('palette.actions.language', { value: 'English' }),
    ]);
  });

  it('offers Sign out (7)', () => {
    expect(group(paletteGroups(context()), 'actions')?.items.at(-1))
      .toMatchObject({ label: t('auth.signOut'), command: { kind: 'signOut' } });
  });

  it('given a search that looks like a hostname, offers Trace <hostname> in the current workspace first (7)', () => {
    const actions = (q: string) => group(paletteGroups(context({ q, entities: { state: 'done', hits: [] } })), 'actions')?.items;

    expect(actions(' App.Homelab.example ')?.[0]).toMatchObject({
      label: t('palette.actions.trace', { hostname: 'app.homelab.example' }),
      command: { kind: 'navigate', to: '/w/home/trace?hostname=app.homelab.example' },
    });
    expect(actions('router')?.[0]?.label).not.toMatch(/router/);
  });

  it('gives each group its icon and color: entities primary, pages info, workspaces secondary, actions warning (8)', () => {
    const groups = paletteGroups(context({ q: 'a', entities: { state: 'done', hits: [] } }));

    expect(groups.map(({ id, label, color, icon }) => ({ id, label, color, icon }))).toEqual([
      { id: 'entities', label: t('palette.groups.entities'), color: 'primary', icon: 'i-lucide-box' },
      { id: 'pages', label: t('palette.groups.pages'), color: 'info', icon: 'i-lucide-file-text' },
      { id: 'workspaces', label: t('palette.groups.workspaces'), color: 'secondary', icon: 'i-lucide-folder' },
      { id: 'actions', label: t('palette.groups.actions'), color: 'warning', icon: 'i-lucide-zap' },
    ]);
  });
});
