# Contributing to Stackmap

Thanks for your interest. Stackmap is in early development: before working on something sizeable, open an issue so we
can agree on the approach.

By contributing, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md) and, on your first pull request, sign the
[Contributor License Agreement](docs/CLA.md) (the CLA bot explains how).

## Setup

Requirements: Node.js 24 (`nvm use` reads `.nvmrc`), Corepack, Git, and Docker for the Postgres tests.

```sh
nvm use
corepack enable
pnpm install
pnpm exec playwright install chromium   # browser for the story tests
pnpm dev                                # http://localhost:3000
```

`pnpm install` also installs the Git hooks. A dev container (app + Postgres) is available in `.devcontainer/`.

Behind a TLS-inspecting proxy, downloads made by Node (such as `playwright install`) may fail with
`SELF_SIGNED_CERT_IN_CHAIN`. Prefix the command with `NODE_OPTIONS=--use-system-ca` to trust your system certificates.

## Commands

| Command                | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `pnpm dev`             | Start the app with hot reload                                        |
| `pnpm build`           | Build the production server into `.output/`                         |
| `pnpm lint`            | ESLint (`pnpm lint:fix` to fix)                                      |
| `pnpm lint:css`        | Stylelint                                                            |
| `pnpm typecheck`       | Type-check the whole project                                        |
| `pnpm test`            | Every test: unit, scripts and stories (in every theme and locale)   |
| `pnpm test:unit`       | Node-side tests only (fast)                                          |
| `pnpm test:stories`    | Stories as tests in Chromium                                         |
| `pnpm test:coverage`   | Node-side tests with coverage thresholds                             |
| `pnpm test:mutation`   | Mutation testing of the domain logic (slow, runs nightly in CI)     |
| `pnpm storybook`       | Storybook on http://localhost:6006                                   |
| `pnpm check:stories`   | Fail if a component has no story                                     |
| `pnpm commit`          | Write a commit message interactively with gitmoji                    |

## How we work: tests first

Tests are the specification. A feature starts with **test names that state its acceptance criteria**, reviewed before
any code is written. Then:

1. turn them into failing tests and run them to see them fail;
2. write the minimum code to make them pass;
3. refactor with the tests passing.

In a pull request this shows as a `✅ Add tests for …` commit before the implementation commit. Never weaken, skip or
delete a test to make it pass without explaining why in the pull request.

| Layer       | Tool                           | Where                                             |
| ----------- | ------------------------------ | ------------------------------------------------- |
| Unit        | Vitest                         | `*.test.ts` next to the code, `tests/unit/`       |
| Component   | Storybook stories, run by Vitest in Chromium | `*.stories.ts` next to each component |
| End to end  | Playwright + axe (with the first pages) | `tests/e2e/`                             |

Domain code needs at least 90% coverage, the rest 80%. A nightly mutation run checks that the tests actually catch
bugs.

### Components

Components follow atomic design in `app/components/{atoms,molecules,organisms,templates}/`. Every component has a
`<Name>.stories.ts` next to it, covering its variants and states (loading, empty, error). Stories run as tests in both
themes, both contrast modes and both locales, and fail on any axe violation. Components use Nuxt APIs only through
auto-imports; see [ADR 1](docs/adr/0001-storybook-with-the-vue-vite-framework.md).

### Accessibility and translations

Stackmap targets RGAA 4.1 / WCAG 2.1 AA, with a strict mode. Use the semantic color utilities (`text-muted`,
`bg-elevated`…), never palette shades, and put every string in `i18n/locales/en.json` and `fr.json`. See the
**Foundations** pages in Storybook.

## Branches and commits

- `main` holds released code and `develop` is the integration branch.
- Work on `feature-<slug>`, `fix-<slug>` or `chore-<slug>` (tooling, dependencies, CI, docs), branched from `develop`.
  Slugs are lowercase kebab-case with an optional issue number, e.g. `feature-42-graph-filters`.
- Open pull requests into `develop`. They are squash-merged, so **the pull request title becomes the commit**.

Commit messages and pull request titles use `<gitmoji> <Title>`:

- a gitmoji from [gitmoji.dev](https://gitmoji.dev) as a Unicode emoji (✨, not `:sparkles:`);
- a title in the imperative mood that completes "If applied, this commit would…", starting with a capital letter,
  without a trailing period;
- a header shorter than 80 characters, and an optional body after a blank line.

```text
✨ Add exposure filter to the graph view
🐛 Fix trace skipping NAT hops
♿️ Improve keyboard focus in the detail panel
```

Git hooks check this on every commit and push, and CI checks it again on every pull request. `pnpm commit` helps you
write the message. Commits must be signed to be merged into `develop` or `main`.

## Pull requests

Fill in the template checklist. CI must pass: lint, typecheck, unit tests with coverage, story tests, build and
conventions.

### AI-assisted contributions

AI coding assistants are welcome. You remain responsible for every line you submit:

- review and understand the code before opening the pull request;
- tick the "AI assistance" box in the template;
- the same tests, checks and review apply;
- never paste secrets or private infrastructure data into a prompt.

Agents should read [AGENTS.md](AGENTS.md).

## Releases (maintainers)

1. On an up-to-date `develop`, run `pnpm release:prepare` (or `pnpm release:prepare 1.2.0`). It opens a
   `🔖 Release vX.Y.Z` pull request with the version bump and the changelog.
2. Merge it, then open a pull request from `develop` into `main` with the same title and merge it with a merge commit.
3. The release workflow tags the version and publishes the GitHub release and the Docker images.
