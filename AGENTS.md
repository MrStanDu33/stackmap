# Agent instructions

Stackmap is a self-hosted tool that documents infrastructure (hosts, services, DNS, proxies, VPNs, auth) and draws it
as graphs. Nuxt 4 full-stack app, Nuxt UI 4, TypeScript strict, pnpm. Read `docs/PRODUCT.md` for who it serves,
`docs/ARCHITECTURE.md` before structural changes, `docs/ROADMAP.md` for what is planned, `docs/DECISIONS.md` for why.

## Commands

```sh
pnpm install            # Node 24 (.nvmrc), pnpm via Corepack
pnpm dev                # app on :3000
pnpm lint               # ESLint (lint:fix to fix); pnpm lint:css for Stylelint
pnpm typecheck
pnpm test:unit          # Node-side unit tests, fast; -u updates docs/api/openapi.json
pnpm test:integration   # SQLite, and Postgres when TEST_POSTGRES_URL is set (pnpm db:test:up starts one on :55432)
pnpm test:stories       # stories as tests in Chromium, every theme × contrast × locale
pnpm test               # the Vitest projects above (scripts, unit, integration, stories); not e2e or smoke
pnpm test:coverage      # unit + integration with thresholds
pnpm build && pnpm test:e2e   # Playwright + axe against the built app, with and without the demo
pnpm test:smoke         # Docker image smoke tests (needs a built stackmap:local and port 3000 free)
pnpm test:stories:hunt  # stories 5× shuffled and overloaded, never retried (nightly on CI)
pnpm storybook          # :6006
pnpm check:stories      # every component has a story
```

Coverage: 80%, 90% for domain, database, repository, SDK and extension server and entity code; `vitest.config.ts` is
the source of truth.

## Folder map

`app/` pages, components (`atoms|molecules|organisms|templates`), composables, CSS tokens · `server/` API routes,
domain logic, repositories, database and migrations, auth, CLI · `shared/` contracts and design rules ·
`extensions/<id>/` built-in extensions (`core` is one) · `packages/extension-sdk/` the SDK · `i18n/locales/` en, fr ·
`tests/` cross-module, e2e and smoke tests, support · `scripts/` conventions, checks, release · `docs/`.
Scoped rules: `app/components/AGENTS.md`, `server/AGENTS.md`, `extensions/AGENTS.md`, `tests/AGENTS.md`.

## Workflow: tests are the spec

Scale it by size. **Feature**: full spec. **Fix**: short spec (the bug, the expected behavior, the test that
reproduces it). **Chore** (dependencies, CI, docs): no spec, still a passing check.

1. Draft the spec in `.ai/specs/<slug>.md` (gitignored), following `.github/ISSUE_TEMPLATE/spec.yml`: acceptance
   criteria in Given/When/Then, contracts, UI states, a11y and i18n, edge cases, out of scope, slices and PRs.
   **Stop and get the user's approval.** Then, with their confirmation, post it as a Spec issue
   (`gh issue create --body-file`); edit the issue when an approved change alters it.
2. Write test skeletons named after the criteria (`it.todo`, Playwright `test.fixme`) and have them reviewed.
3. Turn them into failing tests and run them: see each fail for the right reason. Commit them as
   `🧪 Add failing tests for …`.
4. Implement the minimum to pass, then refactor with the tests passing.

Never weaken, skip or delete a test to get green. A hook blocks edits to untested source in `app/`, `server/`,
`shared/`, `extensions/` and `packages/` (pages, layouts, migrations, config, contracts, types and barrels are exempt).

## Task size

One pull request = one shippable part of a feature, green, revertable as one squash commit, linked with `Closes #n`
or `Part of #n`. One commit = one concern; only the `🧪` commit may fail. Propose a split whenever a spec has
independent parts or a PR would exceed about 400 changed lines, not counting tests, locales, generated files and
`docs/api/openapi.json`. Stack branches when one part needs another.

## Definition of done

A task is done when:

- every acceptance criterion has a test that failed first and passes now;
- `pnpm lint`, `pnpm lint:css`, `pnpm typecheck` and the affected test projects pass;
- every new string is in `en.json` and `fr.json`; a changed contract has `docs/api/openapi.json` regenerated;
- a page or layout change was checked in a browser on `pnpm dev`: keyboard, both themes, strict contrast, French;
- the docs the change affects are updated in the same change (see Docs).

Before a pull request, also: the full `pnpm test`, `pnpm build && pnpm test:e2e` when pages changed, and the reviewers
(security for server, auth or data; accessibility for UI; i18n for strings). CI blocks the merge on lint, unit,
integration with coverage, stories, build, e2e, CodeQL, dependency review and conventions.

## Code rules

- Components: atomic design, registered without path prefix, each with `<Name>.stories.ts` covering variants and
  states. Nuxt APIs through auto-imports only, never `#imports` (stories use the shims in `.storybook/nuxt-shims.ts`).
- Styles: Nuxt UI components and semantic utilities (`text-muted`, `bg-elevated`); never palette shades or raw
  colors. Tokens: `app/assets/css/tokens.css` (see `docs/DESIGN.md`).
- Icons: Lucide only (`i-lucide-…`), bundled.
- Strings: every user-facing string through i18n, in both `i18n/locales/en.json` and `fr.json`.
- Accessibility: RGAA 4.1 plus WCAG 2.2 AA's added criteria (no drag without a single-pointer alternative, 24 px
  targets, focus not obscured, accessible sign-in). Keyboard access, visible focus, labels, no information by color
  alone, an accessible table or form for every graph or canvas.
- API: contract first in `shared/contracts/` (a description, a declared tag, every field described with `examples`,
  an example per response), added to `CONTRACTS`, implemented in `server/api/` with `defineContractHandler`. Errors
  are Problem Details with a code in `PROBLEMS`. Bound every field with `shared/contracts/formats.ts` and every array
  with `.max()`.
- Data: one code path for SQLite and Postgres; every query goes through workspace-scoped repositories.
- Extensions: new entity types and kinds go in an extension's manifest (see `extensions/AGENTS.md`), never in a
  database enum; core entities live in `extensions/core`.
- Security: assume the database can leak; never store secrets of the documented infrastructure. Fixtures, specs,
  issues and screenshots use the fictional demo stack only.
- Style: ESLint and Stylelint decide formatting (semicolons, single quotes, 2 spaces, 120 columns). Comments explain
  why, not what.

## Git

- Branches `feature-<slug>`, `fix-<slug>`, `chore-<slug>` from `develop`; pull requests target `develop` and are
  squash-merged, so the PR title becomes the commit. `develop` reaches `main` through a merge commit.
- Commits and PR titles: `<gitmoji> <Title>`, a Unicode gitmoji from gitmoji.dev, imperative mood ("If applied, this
  commit would …"), capitalized, no trailing period, under 80 characters. Example: `✨ Add exposure filter`.
- The agent stages one commit at a time and proposes its message; it commits only when the human asks. Commits are
  signed.
- Update a branch by rebasing it onto `origin/develop`, never by merging `develop` into it.

## Docs

Keep docs true in the same pull request as the change: architecture → `docs/ARCHITECTURE.md`; a command, convention
or rule → this file or a scoped one, and `CONTRIBUTING.md` for humans; a shipped slice → tick `docs/ROADMAP.md`; a
major decision → a dated entry in `docs/DECISIONS.md` (no ADR files). Durable findings go in the docs, never only in
chat or an agent's memory.

## Human review gates

Ask before: committing or pushing; creating or editing pull requests, issues, labels, projects or releases (any
GitHub write); adding, removing or upgrading a dependency; editing migrations, auth and roles, CI, Docker, Git hooks
or agent settings; deleting files. Never push to `main` or `develop`, force-push, or skip hooks with `--no-verify`.

## Context and parallel work

- One session per slice; clear between unrelated tasks. Keep a "Status / next step" line at the top of the spec in
  `.ai/specs/` as the handoff note.
- Parallel agents only for read-only work (reviews, research) or a second slice in its own worktree that touches
  other files. Never two agents writing the same files.

## AI tools

Claude Code is the supported agent tool (`CLAUDE.md` imports this file; nested `CLAUDE.md` files import the scoped
ones). Adding another tool means adding its rule files in the same pull request and listing it in `docs/TOOLING.md`.

## Do not

- Commit secrets, `.env` files or real infrastructure data.
- Edit generated files (`.nuxt/`, `.output/`, `docs/api/openapi.json` by hand, `pnpm-lock.yaml` by hand).
- Add a dependency without saying why in the pull request.
- Read `.env*` or the local database files.

Tooling (MCP servers, skills, subagents, hooks): `docs/TOOLING.md`.
