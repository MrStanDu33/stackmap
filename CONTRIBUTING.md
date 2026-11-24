# Contributing to Stackmap

Thanks for your interest. Stackmap is in early development: before working on something sizeable, open an issue so we
can agree on the approach.

By contributing, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md) and, on your first pull request, sign the
[Contributor License Agreement](docs/CLA.md) (the CLA bot explains how).

This file covers setup, pull requests and releases. The conventions (commands, workflow, code rules, Git rules) live
in one place, [AGENTS.md](AGENTS.md), written for people and AI agents alike; read it before your first change.

## Setup

Requirements: Node.js 24 (`nvm use` reads `.nvmrc`), Corepack, Git, and Docker for the Postgres and smoke tests.

```sh
nvm use
corepack enable
pnpm install
pnpm exec playwright install chromium   # browser for the story tests
pnpm dev                                # http://localhost:3000
```

`pnpm install` also installs the Git hooks. A dev container (app + Postgres) is available in `.devcontainer/`.

To run the app in Docker instead, with hot reload on your checkout: `docker compose -f compose.dev.yaml up`.
`docker compose up -d` runs the production build of your checkout.

Things that trip people up:

- **Postgres tests**: `pnpm db:test:up` starts Postgres on port 55432; run the integration tests with
  `TEST_POSTGRES_URL=postgres://stackmap:stackmap@localhost:55432/stackmap_test`. Without it they run on SQLite only.
- **Smoke tests** (`pnpm test:smoke`) reuse a local image and bind port 3000: build it first
  (`docker build -t stackmap:local .`) and stop the `compose.dev.yaml` container while they run.
- **A global pnpm that cannot switch** to the version in `packageManager`: run `corepack pnpm …`, or put Corepack's
  shims first on your `PATH` (`corepack enable`), since the Git hooks call plain `pnpm`.
- **Behind a TLS-inspecting proxy**, downloads made by Node (such as `playwright install`) may fail with
  `SELF_SIGNED_CERT_IN_CHAIN`. Prefix the command with `NODE_OPTIONS=--use-system-ca` to trust your system
  certificates.

The commands are listed in [AGENTS.md](AGENTS.md#commands). `pnpm commit` writes a commit message interactively with
gitmoji.

### Debugging extensions

- `STACKMAP_DEBUG=extensions pnpm dev` traces every server hook call: handlers in order, durations, errors.
- In the browser console: `localStorage.setItem('stackmap:debug', 'extensions')`, then reload.
- `GET /api/extensions/diagnostics`: each extension's state and errors, its code and hooks, and translation coverage.

## How we work

Tests are the specification: a feature starts with test names that state its acceptance criteria, reviewed before any
code, then failing tests, then the code. Approved specs are tracked as Spec issues. The full workflow, the definition
of done and the code rules are in [AGENTS.md](AGENTS.md); the testing layers are described in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#testing).

## Pull requests

- Branch from `develop` (`feature-<slug>`, `fix-<slug>`, `chore-<slug>`) and open the pull request into `develop`. It
  is squash-merged, so its title becomes the commit and follows the commit convention in AGENTS.md.
- Keep it small: one shippable part of a feature, linked to its issue with `Closes #…` or `Part of #…`.
- Fill in the template checklist. Commits must be signed.
- CI must pass: lint and typecheck, unit tests, integration tests with coverage, story tests, build, end-to-end tests,
  CodeQL, dependency review and conventions. Merges are also blocked by CodeQL errors and high-severity alerts.

### AI-assisted contributions

AI coding assistants are welcome. You remain responsible for every line you submit:

- review and understand the code before opening the pull request;
- tick the "AI assistance" box in the template;
- the same tests, checks and review apply;
- never paste secrets or private infrastructure data into a prompt.

## Releases (maintainers)

1. On an up-to-date `develop`, run `pnpm release:prepare` (or `pnpm release:prepare 1.2.0`). It opens a
   `🔖 Release vX.Y.Z` pull request with the version bump and the changelog.
2. Merge it, then open a pull request from `develop` into `main` with the same title and merge it with a merge commit.
3. The release workflow tags the version and publishes the GitHub release and the Docker images.
