import { describe, expect, it } from 'vitest';

import { checkSourceEdit } from './tdd-guard-rule.mjs';

/** Builds the inputs of checkSourceEdit from the files that exist and the tests that import the edited file. */
const edit = (path, { files = [], importers = [] } = {}) =>
  checkSourceEdit({ path, exists: (file) => files.includes(file), testsImporting: importers });

describe('TDD guard', () => {
  describe('given a source file in a guarded directory', () => {
    it.each([
      'app/composables/useTrace.ts',
      'server/domain/trace.ts',
      'shared/design/contrast.ts',
      'extensions/vpn/server/domain/derive-flows.ts',
      'packages/extension-sdk/src/define-extension.ts',
      'app/components/atoms/StatusBadge.vue',
    ])('blocks %s when it has no test or story', (path) => {
      const result = edit(path);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/test first/i);
    });

    it('suggests where to write the test', () => {
      expect(edit('server/domain/trace.ts').reason).toContain('server/domain/trace.test.ts');
    });

    it('suggests a story for a component', () => {
      expect(edit('app/components/atoms/StatusBadge.vue').reason).toContain('app/components/atoms/StatusBadge.stories.ts');
    });
  });

  describe('given a source file that has a test', () => {
    it.each([
      ['server/domain/trace.ts', 'server/domain/trace.test.ts'],
      ['server/domain/trace.ts', 'server/domain/trace.spec.ts'],
      ['server/domain/trace.ts', 'tests/unit/server/domain/trace.test.ts'],
      ['app/components/atoms/StatusBadge.vue', 'app/components/atoms/StatusBadge.stories.ts'],
      ['app/components/atoms/StatusBadge.vue', 'app/components/atoms/StatusBadge.test.ts'],
    ])('allows %s next to %s', (path, test) => {
      expect(edit(path, { files: [test] })).toEqual({ allowed: true });
    });

    it('allows a file that an existing test imports', () => {
      expect(edit('server/domain/trace.ts', { importers: ['tests/unit/traces.test.ts'] })).toEqual({ allowed: true });
    });
  });

  describe('given a file the guard does not cover', () => {
    it.each([
      ['a test', 'server/domain/trace.test.ts'],
      ['a story', 'app/components/atoms/StatusBadge.stories.ts'],
      ['a page', 'app/pages/graph.vue'],
      ['a layout', 'app/layouts/default.vue'],
      ['the app root', 'app/app.vue'],
      ['the error page', 'app/error.vue'],
      ['a migration', 'server/migrations/0001-create-hosts.ts'],
      ['an extension migration', 'extensions/vpn/server/migrations/0001-create-vpns.ts'],
      ['a config file', 'app/app.config.ts'],
      ['an API contract', 'shared/contracts/hosts.ts'],
      ['a type declaration', 'shared/types/entities.d.ts'],
      ['a types module', 'shared/types/entities.ts'],
      ['a barrel', 'packages/extension-sdk/src/index.ts'],
      ['a stylesheet', 'app/assets/css/tokens.css'],
      ['a locale file', 'i18n/locales/en.json'],
      ['a file outside the guarded directories', 'scripts/release/changelog.mjs'],
      ['a root config', 'nuxt.config.ts'],
    ])('allows %s (%s)', (_kind, path) => {
      expect(edit(path)).toEqual({ allowed: true });
    });
  });
});
