import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { issueKey, ZOD_ISSUE_CODES } from '../../../app/utils/issue-message';
import { createTestI18n } from '../../support/i18n';

const ROOT = join(import.meta.dirname, '../../..');
const CODE = /code: '([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)'/g;

/** The `<id>.<rule>` codes raised in the extensions' and the SDK's source, tests aside. */
const raisedCodes = (): string[] => {
  const files = ['extensions', 'packages/extension-sdk/src'].flatMap((dir) => readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.includes('node_modules'))
    .map((file) => join(ROOT, dir, file)));
  return [...new Set(files.flatMap((file) => [...readFileSync(file, 'utf8').matchAll(CODE)].map(([, code]) => code ?? '')))].sort();
};

const missing = (codes: readonly string[], locale: 'en' | 'fr') => {
  const { global: i18n } = createTestI18n(locale);
  return codes.map(issueKey).filter((key) => !i18n.te(key, locale));
};

describe('extension issue codes', () => {
  it('translates every <id>.<rule> code an extension\'s schemas raise, in English and French', () => {
    const codes = raisedCodes();

    expect(codes).toContain('core.duplicate-address');
    expect(missing(codes, 'en')).toEqual([]);
    expect(missing(codes, 'fr')).toEqual([]);
  });

  it('translates every Zod code the entity schemas can raise in the app\'s issues.*, in English and French', () => {
    const codes = [...ZOD_ISSUE_CODES, 'unknown-kind'];

    expect(missing(codes, 'en')).toEqual([]);
    expect(missing(codes, 'fr')).toEqual([]);
  });
});
