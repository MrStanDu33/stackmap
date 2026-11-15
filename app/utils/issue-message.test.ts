import { describe, expect, it } from 'vitest';

import { issueKey, issueMessage } from './issue-message';
import { createTestI18n } from '../../tests/support/i18n';

import type { Issue } from './issue-message';

const i18nFor = (locale: 'en' | 'fr') => {
  const { global: i18n } = createTestI18n(locale);
  return {
    t: (key: string, params?: Record<string, unknown>) => i18n.t(key, params ?? {}),
    te: (key: string) => i18n.te(key),
  };
};

const issue = (code: string, params: Issue['params'] = {}, message = 'English fallback'): Issue => ({
  path: 'body.name', code, params, message,
});

describe('issueMessage', () => {
  it('translates a Zod code from issues.<code> with its params', () => {
    const tooSmall = issue('too_small', { minimum: 1, origin: 'string' });

    expect(issueKey('too_small')).toBe('issues.too_small');
    expect(issueMessage(tooSmall, i18nFor('en'))).toBe(i18nFor('en').t('issues.too_small', { minimum: 1, origin: 'string' }));
    expect(issueMessage(tooSmall, i18nFor('en'))).toContain('1');
    expect(issueMessage(tooSmall, i18nFor('fr'))).not.toBe(issueMessage(tooSmall, i18nFor('en')));
  });

  it('translates an extension code <id>.<rule> from extensions.<id>.issues.<rule> with its params', () => {
    const duplicate = issue('core.duplicate-address', { address: '192.0.2.10' });

    expect(issueKey('core.duplicate-address')).toBe('extensions.core.issues.duplicate-address');
    expect(issueMessage(duplicate, i18nFor('en'))).toContain('192.0.2.10');
    expect(issueMessage(duplicate, i18nFor('en'))).not.toBe('English fallback');
  });

  it('translates an SDK common code from issues.common.<rule>', () => {
    expect(issueKey('common.too-many-custom-fields')).toBe('issues.common.too-many-custom-fields');
    expect(issueMessage(issue('common.too-many-custom-fields', { maximum: 50 }), i18nFor('en'))).toContain('50');
  });

  it('falls back to the issue\'s English message when the code has no translation', () => {
    expect(issueMessage(issue('core.not-a-rule'), i18nFor('fr'))).toBe('English fallback');
    expect(issueMessage(issue('vpn.peer-unknown'), i18nFor('en'))).toBe('English fallback');
  });

  it('falls back to the English message for a code without a dot that is not a known Zod code', () => {
    expect(issueMessage(issue('something_new'), i18nFor('en'))).toBe('English fallback');
  });
});
