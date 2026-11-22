import { describe, expect, it } from 'vitest';

import { paletteFilters } from './palette-filters';
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

  it('given words that name nothing in full, offers nothing (14)', () => {
    expect(offered('host')).toHaveLength(1);
    expect(offered('')).toEqual([]);
    expect(offered('host router')).toEqual([]);
    expect(offered('router')).toEqual([]);
    expect(offered('hos')).toEqual([]);
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
});
