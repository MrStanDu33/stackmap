import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { checkThemeContrast } from '../../../shared/design/contrast';
import { UI_COLORS } from '../../../shared/design/ui-colors';

import type { ContrastLevel } from '../../../shared/design/contrast';

const TOKENS_CSS = join(import.meta.dirname, '../../../app/assets/css/tokens.css');

const LIGHT = ':root';
const MIDNIGHT = '.dark';
const LIGHT_STRICT = ':root[data-contrast=\'strict\']';
const MIDNIGHT_STRICT = '.dark[data-contrast=\'strict\']';

/** Rules applied by each theme, in cascade order (all rules are unlayered, so later or more specific wins). */
const THEMES: Record<string, { rules: string[]; level: ContrastLevel }> = {
  light: { rules: [LIGHT], level: 'standard' },
  midnight: { rules: [LIGHT, MIDNIGHT], level: 'standard' },
  'light strict': { rules: [LIGHT, LIGHT_STRICT], level: 'strict' },
  'midnight strict': { rules: [LIGHT, MIDNIGHT, LIGHT_STRICT, MIDNIGHT_STRICT], level: 'strict' },
};

const VAR_REFERENCE = /^var\(\s*(--[\w-]+)\s*\)$/;

const parseCss = (path: string) => postcss.parse(readFileSync(path, 'utf8'));

const root = parseCss(TOKENS_CSS);

const declarations = (
  css: postcss.Root,
  filter: (node: postcss.Container) => boolean,
): Map<string, string> => {
  const found = new Map<string, string>();
  css.walkDecls(/^--/, (decl) => {
    if (decl.parent && filter(decl.parent)) {
      found.set(decl.prop, decl.value);
    }
  });
  return found;
};

const isThemeBlock = (parent: postcss.Container) => parent.type === 'atrule' && (parent as postcss.AtRule).name === 'theme';

/** Tailwind's default palettes (`--color-emerald-700`…) followed by ours, which take precedence. */
const palette = new Map([
  ...declarations(parseCss(createRequire(import.meta.url).resolve('tailwindcss/theme.css')), isThemeBlock),
  ...declarations(root, isThemeBlock),
]);

const ruleDeclarations = (selector: string): Map<string, string> =>
  declarations(root, (parent) => parent.type === 'rule' && (parent as postcss.Rule).selector === selector);

const resolve = (value: string, scope: Map<string, string>, depth = 0): string => {
  const reference = VAR_REFERENCE.exec(value)?.[1];
  if (!reference || depth > 10) {
    return value;
  }
  const target = scope.get(reference) ?? palette.get(reference);
  if (target === undefined) {
    throw new Error(`Unresolved ${reference} in tokens.css`);
  }
  return resolve(target, scope, depth + 1);
};

/** Semantic tokens of a theme, named like Nuxt UI's variables without the `--ui-` prefix. */
const themeTokens = (rules: string[]): Record<string, string> => {
  const scope = new Map(rules.flatMap((selector) => [...ruleDeclarations(selector)]));
  return Object.fromEntries([...scope]
    .filter(([name]) => name.startsWith('--ui-'))
    .map(([name, value]) => [name.slice('--ui-'.length), resolve(value, scope)]));
};

describe('theme tokens (app/assets/css/tokens.css)', () => {
  it('define the nebula and midnight palettes', () => {
    const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
    for (const name of ['nebula', 'midnight']) {
      expect(shades.filter((shade) => !palette.has(`--color-${name}-${shade}`))).toEqual([]);
    }
  });

  it.each(Object.entries(THEMES))('meet the contrast requirements in the %s theme', (_name, { rules, level }) => {
    expect(checkThemeContrast(themeTokens(rules), level)).toEqual([]);
  });

  it.each(Object.entries(UI_COLORS).filter(([alias]) => alias !== 'neutral'))(
    'use the %s palette mapped in UI_COLORS (%s) in every theme',
    (alias, paletteName) => {
      const values = [LIGHT, MIDNIGHT, LIGHT_STRICT, MIDNIGHT_STRICT]
        .map((selector) => ruleDeclarations(selector).get(`--ui-${alias}`));
      expect(values.filter((value) => !value?.startsWith(`var(--color-${paletteName}-`))).toEqual([]);
    },
  );

  // Our rules are unlayered and beat Nuxt UI's layered `.dark`, so any token set only for light would leak into dark.
  it('override in midnight every token that light sets', () => {
    const missing = [...ruleDeclarations(LIGHT).keys()].filter((name) => !ruleDeclarations(MIDNIGHT).has(name));
    expect(missing).toEqual([]);
  });

  // `:root[data-contrast]` is more specific than `.dark`, so light strict tokens would leak into midnight strict.
  it('override in midnight strict every token that light strict sets', () => {
    const missing = [...ruleDeclarations(LIGHT_STRICT).keys()]
      .filter((name) => !ruleDeclarations(MIDNIGHT_STRICT).has(name));
    expect(missing).toEqual([]);
  });
});
