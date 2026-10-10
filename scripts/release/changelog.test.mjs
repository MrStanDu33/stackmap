import { describe, expect, it } from 'vitest';

import {
  buildChangelogSection,
  CHANGELOG_HEADER,
  extractReleaseNotes,
  nextVersion,
  prependSection,
} from './changelog.mjs';

describe('nextVersion', () => {
  it.each([
    ['1.2.3', ['🐛 Fix trace skipping NAT hops'], '1.2.4'],
    ['1.2.3', ['🐛 Fix trace', '✨ Add graph filters'], '1.3.0'],
    ['1.2.3', ['✨ Add graph filters', '💥 Remove the v1 API'], '2.0.0'],
    ['1.2.3', ['📝 Update the README'], '1.2.4'],
  ])('bumps %s to the highest gitmoji semver level of %j: %s', (current, subjects, expected) => {
    expect(nextVersion(current, subjects)).toBe(expected);
  });

  it('bumps the minor version for breaking changes before 1.0.0', () => {
    expect(nextVersion('0.4.1', ['💥 Remove the v1 API'])).toBe('0.5.0');
  });

  it('bumps the minor version for features before 1.0.0', () => {
    expect(nextVersion('0.4.1', ['✨ Add graph filters'])).toBe('0.5.0');
  });
});

describe('buildChangelogSection', () => {
  const section = buildChangelogSection({
    version: '0.2.0',
    date: '2026-10-10',
    subjects: [
      '✨ Add graph filters (#12)',
      '🐛 Fix trace skipping NAT hops (#13)',
      '💥 Remove the legacy import (#14)',
      '📝 Update the README (#15)',
      '🔖 Release v0.1.0 (#11)',
    ],
  });

  it('starts with the version and the date', () => {
    expect(section.split('\n')[0]).toBe('## 0.2.0 - 2026-10-10');
  });

  it('groups changes by semver level, most important first', () => {
    const headings = section.split('\n').filter((line) => line.startsWith('### '));
    expect(headings).toEqual(['### 💥 Breaking changes', '### ✨ Features', '### 🐛 Fixes and improvements', '### 🧰 Other changes']);
  });

  it('lists each change without its gitmoji', () => {
    expect(section).toContain('- Add graph filters (#12)');
    expect(section).toContain('- Fix trace skipping NAT hops (#13)');
  });

  it('leaves out release commits', () => {
    expect(section).not.toContain('Release v0.1.0');
  });

  it('leaves out empty groups', () => {
    const fixesOnly = buildChangelogSection({ version: '0.2.1', date: '2026-10-11', subjects: ['🐛 Fix a crash'] });
    expect(fixesOnly).not.toContain('Features');
  });
});

describe('prependSection', () => {
  it('creates the changelog when it does not exist yet', () => {
    expect(prependSection('', '## 0.1.0 - 2026-10-10\n')).toBe(`${CHANGELOG_HEADER}\n## 0.1.0 - 2026-10-10\n`);
  });

  it('puts the newest release right after the header', () => {
    const changelog = `${CHANGELOG_HEADER}\n## 0.1.0 - 2026-10-10\n\n- First\n`;
    const updated = prependSection(changelog, '## 0.2.0 - 2026-10-11\n\n- Second\n');
    expect(updated.indexOf('## 0.2.0')).toBeLessThan(updated.indexOf('## 0.1.0'));
    expect(updated.startsWith(CHANGELOG_HEADER)).toBe(true);
  });
});

describe('extractReleaseNotes', () => {
  const changelog = [
    CHANGELOG_HEADER,
    '## 0.2.0 - 2026-10-11',
    '',
    '### ✨ Features',
    '',
    '- Second',
    '',
    '## 0.1.0 - 2026-10-10',
    '',
    '- First',
    '',
  ].join('\n');

  it('returns the body of the requested version', () => {
    expect(extractReleaseNotes(changelog, '0.2.0')).toBe('### ✨ Features\n\n- Second');
  });

  it('returns the last section up to the end of the file', () => {
    expect(extractReleaseNotes(changelog, '0.1.0')).toBe('- First');
  });

  it('throws when the version is not in the changelog', () => {
    expect(() => extractReleaseNotes(changelog, '9.9.9')).toThrow(/9\.9\.9/);
  });
});
