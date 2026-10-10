/** Directories whose code must be test-driven. */
const GUARDED = /^(?:app|server|shared|extensions\/[^/]+|packages\/[^/]+)\//;

const CODE = /\.(?:[cm]?[jt]s|vue)$/;

/** Files that are not tested through a test of their own: covered by e2e tests, declarative, or generated. */
const EXEMPT = [
  /\.(?:test|spec|stories)\.[cm]?[jt]s$/,
  /\.d\.ts$/,
  /(?:^|\/)app\/(?:pages|layouts)\//,
  /(?:^|\/)app\/(?:app|error)\.vue$/,
  /\/migrations\//,
  /\/generated\//,
  /\.config\.[cm]?[jt]s$/,
  /^shared\/contracts\//,
  /\/types\//,
  /(?:^|\/)index\.[cm]?[jt]s$/,
];

const withoutExtension = (path) => path.replace(/\.[^./]+$/, '');

const candidateTests = (path) => {
  const stem = withoutExtension(path);
  const colocated = [`${stem}.test.ts`, `${stem}.spec.ts`, `${stem}.test.mjs`];
  const stories = path.endsWith('.vue') ? [`${stem}.stories.ts`] : [];
  return [...stories, ...colocated, `tests/unit/${stem}.test.ts`];
};

/**
 * Decides whether an agent may edit a source file: test-driven code needs a test (or a story) first.
 *
 * @param {{ path: string, exists: (path: string) => boolean, testsImporting: string[] }} edit
 *   `path` is relative to the repository root; `testsImporting` lists the test files that import it.
 * @returns {{ allowed: true } | { allowed: false, reason: string }}
 */
export const checkSourceEdit = ({ path, exists, testsImporting }) => {
  if (!GUARDED.test(path) || !CODE.test(path) || EXEMPT.some((pattern) => pattern.test(path))) {
    return { allowed: true };
  }
  const candidates = candidateTests(path);
  if (candidates.some(exists) || testsImporting.length > 0) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `TDD guard: write the test first. ${path} has no test or story yet. Create a failing one, such as `
      + `${candidates[0]}, run it to see it fail, then implement. See CONTRIBUTING.md.`,
  };
};
