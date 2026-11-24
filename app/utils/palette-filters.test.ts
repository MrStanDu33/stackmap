import { describe, expect, it } from 'vitest';

import { availableFilters, paletteFilters } from './palette-filters';
import { createTestI18n } from '../../tests/support/i18n';

import type { PaletteFilterContext } from './palette-filters';

const english = createTestI18n('en').global;
const t = (key: string, params: Record<string, unknown> = {}) => english.t(key, params);

const context = (overrides: Partial<PaletteFilterContext> = {}): PaletteFilterContext => ({
  q: '',
  t,
  extensions: [
    { id: 'core', name: 'Core', icon: 'i-lucide-layers' },
    { id: 'nat', name: 'Router and NAT', icon: 'i-lucide-arrow-right-left' },
  ],
  types: [
    { extension: 'core', entity: 'host', name: 'Host', plural: 'Hosts', icon: 'i-lucide-layers' },
    {
      extension: 'nat', entity: 'port-forward', name: 'Port forward', plural: 'Port forwards', icon: 'i-lucide-arrow-right-left',
    },
  ],
  hidden: [],
  filter: null,
  ...overrides,
});

const offered = (q: string, overrides: Partial<PaletteFilterContext> = {}) =>
  paletteFilters(context({ q, ...overrides })).map(({ filter }) => filter);

describe('paletteFilters', () => {
  it('given a word naming a group, in its singular or plural, ignoring case and accents ("page", "Pages", "PÂGE"), offers that group (14)', () => {
    for (const q of ['page', 'Pages', ' PÂGE ']) {
      expect(offered(q), q).toEqual([{ kind: 'group', group: 'pages' }]);
    }
    expect(paletteFilters(context({ q: 'pages' }))).toEqual([{
      filter: { kind: 'group', group: 'pages' }, name: 'Page', word: 'pages', icon: 'i-lucide-file-text', color: 'info',
    }]);
  });

  it('given a word naming an extension by its id or name ("nat") or an entity type, in its singular or plural ("host", "Hosts"), offers it (14)', () => {
    expect(paletteFilters(context({ q: 'nat' }))).toEqual([{
      filter: { kind: 'extension', extension: 'nat' }, name: 'Router and NAT', word: 'nat', icon: 'i-lucide-arrow-right-left', color: 'primary',
    }]);
    expect(offered('Router and NAT')).toEqual([{ kind: 'extension', extension: 'nat' }]);
    expect(offered('port forward')).toEqual([{ kind: 'type', extension: 'nat', entity: 'port-forward' }]);
    for (const q of ['host', 'Hosts']) {
      expect(paletteFilters(context({ q })), q).toEqual([{
        filter: { kind: 'type', extension: 'core', entity: 'host' }, name: 'Host', word: q, icon: 'i-lucide-layers', color: 'primary',
      }]);
    }
  });

  it('names them in the current language: "hôte" offers the Host type in French (14)', () => {
    const french = createTestI18n('fr').global;
    const offers = paletteFilters(context({
      q: 'hote',
      t: (key, params = {}) => french.t(key, params),
      types: [{ extension: 'core', entity: 'host', name: 'Hôte', plural: 'Hôtes' }],
    }));

    expect(offers.map(({ name }) => name)).toEqual(['Hôte']);
    expect(offered('entité', { t: (key, params = {}) => french.t(key, params) })).toEqual([{ kind: 'group', group: 'entities' }]);
  });

  it('given letters found in no name in that order, offers nothing (14)', () => {
    expect(offered('host')).toHaveLength(1);
    expect(offered('')).toEqual([]);
    expect(offered('host router')).toEqual([]);
    expect(offered('edge')).toEqual([]);
    expect(offered('wfo')).toEqual([]);
  });

  it('given a word naming a type and its extension alike, offers both (14)', () => {
    const offers = offered('site', {
      extensions: [{ id: 'site', name: 'Sites' }],
      types: [{ extension: 'site', entity: 'site', name: 'Site', plural: 'Sites' }],
    });

    expect(offers).toEqual([{ kind: 'extension', extension: 'site' }, { kind: 'type', extension: 'site', entity: 'site' }]);
  });

  it('never offers an extension turned off in the workspace, or a group, extension or type hidden in Settings (14, 17)', () => {
    expect(offered('nat')).toHaveLength(1);
    expect(offered('nat', { extensions: [{ id: 'core', name: 'Core' }] })).toEqual([]);
    expect(offered('pages', { hidden: ['group:pages'] })).toEqual([]);
    expect(offered('nat', { hidden: ['extension:nat'] })).toEqual([]);
    expect(offered('host', { hidden: ['type:core/host'] })).toEqual([]);
    // An extension hidden hides its types; entities hidden hides every extension and type.
    expect(offered('port forwards', { hidden: ['extension:nat'] })).toEqual([]);
    expect(offered('host', { hidden: ['group:entities'] })).toEqual([]);
    expect(offered('nat', { hidden: ['group:entities'] })).toEqual([]);
  });

  it('given a filter already chosen, offers nothing more (15)', () => {
    const filter = { filter: { kind: 'group' as const, group: 'pages' as const }, name: 'Page', word: 'page' };

    expect(offered('host')).toHaveLength(1);
    expect(offered('host', { filter })).toEqual([]);
  });

  it('availableFilters lists every group, extension and type the user can filter by, in that order, leaving out what is hidden or turned off (19)', () => {
    const names = (overrides: Partial<PaletteFilterContext> = {}) =>
      availableFilters(context(overrides)).map(({ name }) => name);

    expect(names()).toEqual(['Entity', 'Page', 'Workspace', 'Action', 'Core', 'Router and NAT', 'Host', 'Port forward']);
    expect(availableFilters(context())[6]).toEqual({
      filter: { kind: 'type', extension: 'core', entity: 'host' }, name: 'Host', word: '', icon: 'i-lucide-layers', color: 'primary',
    });
    expect(names({ hidden: ['group:workspaces', 'extension:nat'] })).toEqual(['Entity', 'Page', 'Action', 'Core', 'Host']);
    expect(names({ hidden: ['group:entities'] })).toEqual(['Page', 'Workspace', 'Action']);
    expect(names({ extensions: [{ id: 'core', name: 'Core' }], types: [] })).toEqual(['Entity', 'Page', 'Workspace', 'Action', 'Core']);
  });

  it('as the user types, offers each filter whose name has a word starting with each typed word: "port", "forw" and "port f" offer Port forward (14)', () => {
    const forward = { kind: 'type', extension: 'nat', entity: 'port-forward' };
    for (const q of ['port', 'forw', 'port f', 'F PORT', 'pôrt']) {
      expect(offered(q), q).toEqual([forward]);
    }
    expect(paletteFilters(context({ q: 'port' }))[0]).toMatchObject({ name: 'Port forward', word: 'port' });
  });

  it('finds what is typed inside a word: "ort" and "orward" offer Port forward (14)', () => {
    const forward = { kind: 'type', extension: 'nat', entity: 'port-forward' };

    // Router and NAT holds o…r…t too, in order: a less exact match, after.
    expect(offered('ort')).toEqual([forward, { kind: 'extension', extension: 'nat' }]);
    expect(offered('orward')).toEqual([forward]);
    expect(offered('hos')).toEqual([{ kind: 'type', extension: 'core', entity: 'host' }]);
  });

  it('finds letters typed in that order: "ofw" offers Port forward (14)', () => {
    expect(offered('ofw')).toEqual([{ kind: 'type', extension: 'nat', entity: 'port-forward' }]);
  });

  it('lists the most exact match first: the whole name, then the starts of its words, then inside a word, then its letters in order (14)', () => {
    const type = (entity: string, name: string) => ({ extension: 'x', entity, name, plural: `${name}s` });
    const names = paletteFilters(context({
      q: 'port',
      extensions: [],
      types: [type('rate', 'Pivot rate'), type('support', 'Support'), type('forward', 'Port forward'), type('port', 'Port')],
    })).map(({ name }) => name);

    expect(names).toEqual(['Port', 'Port forward', 'Support', 'Pivot rate']);
  });

  it('given "router", offers the extension named Router and NAT (14)', () => {
    expect(offered('router')).toEqual([{ kind: 'extension', extension: 'nat' }]);
    expect(offered('na')).toEqual([{ kind: 'extension', extension: 'nat' }]);
  });
});
