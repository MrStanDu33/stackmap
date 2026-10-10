import { parseHeader } from '../conventions/commit-rule.mjs';

export const CHANGELOG_HEADER = `# Changelog

All notable changes to Stackmap are documented here. Versions follow [Semantic Versioning](https://semver.org).
`;

/** Groups of the changelog, from the gitmoji semver levels, most important first. */
const SECTIONS = [
  { semver: 'major', title: '💥 Breaking changes' },
  { semver: 'minor', title: '✨ Features' },
  { semver: 'patch', title: '🐛 Fixes and improvements' },
  { semver: null, title: '🧰 Other changes' },
];

const RELEASE_EMOJI = '🔖';

const parseSubjects = (subjects) => subjects
  .map(parseHeader)
  .filter((parsed) => parsed !== null && parsed.emoji !== RELEASE_EMOJI);

/**
 * Next version from the gitmoji semver levels of the changes. Before 1.0.0, breaking changes and features bump the
 * minor version, everything else the patch version.
 *
 * @param {string} current
 * @param {string[]} subjects Commit subjects since the last release.
 * @returns {string}
 */
export const nextVersion = (current, subjects) => {
  const [major, minor, patch] = current.split('.').map(Number);
  const levels = new Set(parseSubjects(subjects).map(({ semver }) => semver));
  if (major === 0) {
    return levels.has('major') || levels.has('minor') ? `0.${minor + 1}.0` : `0.${minor}.${patch + 1}`;
  }
  if (levels.has('major')) {
    return `${major + 1}.0.0`;
  }
  return levels.has('minor') ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
};

/**
 * @param {{ version: string, date: string, subjects: string[] }} release
 * @returns {string} Markdown section, starting with "## <version> - <date>".
 */
export const buildChangelogSection = ({ version, date, subjects }) => {
  const changes = parseSubjects(subjects);
  const groups = SECTIONS
    .map(({ semver, title }) => ({ title, items: changes.filter((change) => change.semver === semver) }))
    .filter(({ items }) => items.length > 0)
    .map(({ title, items }) => `### ${title}\n\n${items.map((item) => `- ${item.title}`).join('\n')}\n`);
  return [`## ${version} - ${date}\n`, ...groups].join('\n');
};

/** Inserts a release section right after the changelog header, creating the changelog when needed. */
export const prependSection = (changelog, section) => {
  const rest = changelog.startsWith(CHANGELOG_HEADER) ? changelog.slice(CHANGELOG_HEADER.length).trimStart() : '';
  return `${CHANGELOG_HEADER}\n${section}${rest ? `\n${rest}` : ''}`;
};

/**
 * @param {string} changelog
 * @param {string} version
 * @returns {string} The section body of that version, without its heading.
 */
export const extractReleaseNotes = (changelog, version) => {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## ${version} `));
  if (start === -1) {
    throw new Error(`Version ${version} is not in the changelog.`);
  }
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n').trim();
};
