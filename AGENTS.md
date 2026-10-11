# Agent instructions

Stackmap is a self-hosted tool that documents infrastructure (hosts, services, DNS, proxies, VPNs, auth) and draws it
as graphs. Nuxt 4 full-stack app, Nuxt UI 4, TypeScript strict, pnpm. Read `docs/ARCHITECTURE.md` before structural
changes; `docs/ROADMAP.md` says what is planned.

## Commands

```sh
pnpm install            # Node 24 (.nvmrc), pnpm via Corepack
pnpm dev                # app on :3000
pnpm lint               # ESLint (lint:fix to fix), pnpm lint:css for Stylelint
pnpm typecheck
pnpm test:unit          # Node-side tests, fast
pnpm test:stories       # stories as tests in Chromium, every theme × contrast × locale
pnpm test               # everything
pnpm test:coverage      # with thresholds (80%, 90% for domain code)
pnpm storybook          # :6006
pnpm check:stories      # every component has a story
```

## Workflow: tests are the spec

1. Before any code, write a temporary spec in `.ai/specs/<feature>.md` (gitignored, never committed): acceptance
   criteria in Given/When/Then, data and API contracts, UI states, a11y and i18n criteria, edge and error cases.
   **Stop and get the user's approval.**
2. Write test skeletons named after the acceptance criteria (`it.todo`, Playwright `test.fixme`) and have them reviewed.
3. Turn them into failing tests and run them: see them fail.
4. Implement the minimum to pass, then refactor with the tests passing.

Never weaken, skip or delete a test to get green. A hook blocks edits to untested source in `app/`, `server/`,
`shared/`, `extensions/` and `packages/` (pages, layouts, migrations, config, contracts, types and barrels are exempt).

## Code rules

- Components: atomic design in `app/components/{atoms,molecules,organisms,templates}/`, registered without path
  prefix. Each has a `<Name>.stories.ts` covering variants and states. Use Nuxt APIs through auto-imports only, never
  explicit `#imports` (stories render with plain Vue and the shims in `.storybook/nuxt-shims.ts`).
- Styles: Nuxt UI components and semantic utilities (`text-muted`, `bg-elevated`, `text-primary`); never palette
  shades or raw colors. Tokens live in `app/assets/css/tokens.css`.
- Strings: every user-facing string goes through i18n, in both `i18n/locales/en.json` and `fr.json`.
- Accessibility: RGAA 4.1 / WCAG 2.1 AA. Keyboard access, visible focus, labels, no information by color alone, an
  accessible table or form for every graph or canvas.
- API _(from phase 2)_: contract first. Zod schemas and route metadata in `shared/contracts/`, imported by the route.
- Data _(from phase 2)_: every query goes through workspace-scoped repositories; one code path for SQLite and Postgres.
- Style: ESLint and Stylelint decide formatting (semicolons, single quotes, 2 spaces, 120 columns). Comments explain
  why, not what.

## Git

- Branches: `feature-<slug>`, `fix-<slug>`, `chore-<slug>` from `develop`; pull requests target `develop`.
- Commits and PR titles: `<gitmoji> <Title>` with a Unicode gitmoji from gitmoji.dev, imperative mood ("If applied,
  this commit would …"), capitalized, no trailing period, under 80 characters. Example: `✨ Add exposure filter`.
- Failing tests go in a `🧪 Add failing tests for …` commit before the implementation commit.

## Do not

- Commit secrets, `.env` files or real infrastructure data (fixtures use the fictional demo stack).
- Edit generated files (`.nuxt/`, `.output/`, `pnpm-lock.yaml` by hand).
- Add a dependency without saying why in the pull request.
- Push to `main` or `develop`, or skip hooks with `--no-verify`.
