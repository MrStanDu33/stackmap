import { describe, expect, it } from 'vitest';

import { ExtensionAlwaysOnError, ExtensionNotFoundError, toggleChange } from './extension-toggles';

import type { ToggledExtension } from './extension-toggles';

const extension = (id: string, dependsOn: string[] = ['core'], alwaysOn = false): ToggledExtension =>
  ({ id, alwaysOn, dependsOn });

// Registry order: dependencies first, then by id.
const core = extension('core', [], true);
const a = extension('a');
const b = extension('b', ['core', 'a']);
const c = extension('c', ['core', 'b']);
const other = extension('other');
const installed = [core, a, other, b, c];

const none = new Set<string>();

describe('toggleChange', () => {
  it('given b depends on a and both are on, turning a off turns both off, listing a then b (3)', () => {
    expect(toggleChange([core, a, b], none, 'a', false)).toEqual([{ id: 'a', enabled: false }, { id: 'b', enabled: false }]);
  });

  it('given b depends on a and both are off, turning b on turns both on, listing b then a (4)', () => {
    expect(toggleChange([core, a, b], new Set(['a', 'b']), 'b', true))
      .toEqual([{ id: 'b', enabled: true }, { id: 'a', enabled: true }]);
  });

  it('given c depends on b which depends on a, turning a off turns a, b and c off (5)', () => {
    expect(toggleChange(installed, none, 'a', false)).toEqual([
      { id: 'a', enabled: false }, { id: 'b', enabled: false }, { id: 'c', enabled: false },
    ]);
  });

  it('given c depends on b which depends on a, all off, turning c on turns c, a and b on', () => {
    expect(toggleChange(installed, new Set(['a', 'b', 'c']), 'c', true)).toEqual([
      { id: 'c', enabled: true }, { id: 'a', enabled: true }, { id: 'b', enabled: true },
    ]);
  });

  it('given an extension already in the asked state, changes nothing (12)', () => {
    expect(toggleChange(installed, new Set(['other']), 'other', false)).toEqual([]);
    expect(toggleChange(installed, none, 'a', true)).toEqual([]);
  });

  it('leaves out dependents already off, and dependencies already on', () => {
    expect(toggleChange(installed, new Set(['c']), 'a', false)).toEqual([{ id: 'a', enabled: false }, { id: 'b', enabled: false }]);
    expect(toggleChange(installed, new Set(['b']), 'b', true)).toEqual([{ id: 'b', enabled: true }]);
  });

  it('given an always-on extension, refuses to turn it off (13)', () => {
    expect(() => toggleChange(installed, none, 'core', false)).toThrow(ExtensionAlwaysOnError);
  });

  it('given an always-on extension, turning it on changes nothing', () => {
    expect(toggleChange(installed, none, 'core', true)).toEqual([]);
  });

  it('given an id that is not installed, refuses it (14)', () => {
    expect(() => toggleChange(installed, none, 'tls', false)).toThrow(ExtensionNotFoundError);
    expect(() => toggleChange(installed, none, 'tls', true)).toThrow(ExtensionNotFoundError);
  });

  it('given a dependent a cascade turned off, turning its dependency back on leaves it off (edge case)', () => {
    expect(toggleChange(installed, new Set(['a', 'b', 'c']), 'a', true)).toEqual([{ id: 'a', enabled: true }]);
  });
});
