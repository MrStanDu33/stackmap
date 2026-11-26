# Agent tooling

What the repository gives AI agents, why, and what each developer sets up on their own machine. Claude Code is the
only supported agent tool; adding another means adding its rule files and a section here in the same pull request.

## Claude Code

### Rules

| File | Loaded | Holds |
|---|---|---|
| `CLAUDE.md` | every session | `@AGENTS.md` plus Claude-only rules |
| `AGENTS.md` | through `CLAUDE.md` | the tool-neutral rules |
| `app/components/`, `server/`, `extensions/`, `tests/` `CLAUDE.md` | when working in that folder | `@AGENTS.md` of the folder |
| `CLAUDE.local.md` | personal, gitignored | your own overrides |

Claude Code reads `AGENTS.md` on its own only when no `CLAUDE.md` exists, so the `CLAUDE.md` pointers are needed.

### MCP servers (`.mcp.json`)

| Server | Why | Access | Token | Tools |
|---|---|---|---|---|
| `nuxt` | Current Nuxt docs, modules and changelogs | read-only, nuxt.com | none | 13 |
| `nuxt-ui` | Current Nuxt UI components, examples, icons | read-only, ui.nuxt.com | none | 12 |
| `playwright` (`@playwright/mcp`, pinned, `--browser chromium`) | Browser checks of UI changes (`/verify-ui`) | a local Chromium; `browser_run_code_unsafe` denied | none | ~25 |
| `storybook` (`@storybook/addon-mcp`) | List stories and component props | read-only, local; only while `pnpm storybook` runs | none | ~2 |

Claude Code asks you to approve project MCP servers the first time. Tools load on demand, so unused ones cost little.
No database server: agents see data through tests, never the local database. No GitHub server: agents use the `gh`
CLI with your login.

### Skills (`.claude/skills/`)

| Skill | Use |
|---|---|
| `/spec` | Draft the spec, stop for approval, post it as a Spec issue |
| `/tdd` | Skeletons → red → green → refactor from an approved spec |
| `/verify-ui` | Check a page change in a browser on a throwaway instance |
| `/new-component` | Scaffold a component with its story, play function and translations |
| `/new-extension` | Scaffold a built-in extension |
| `/commit` | Stage one commit and propose its message |
| `/pr` | Checks, reviewers, docs check, then the pull request |

### Subagents (`.claude/agents/`)

`security-reviewer`, `a11y-reviewer` and `i18n-checker` review the branch against `origin/develop` before a pull
request. They read and run commands; they never edit files.

### Hooks and permissions (`.claude/settings.json`)

- Before each edit, `scripts/agents/tdd-guard.mjs` blocks source changes that have no test.
- After each edit, `scripts/agents/lint-fix.mjs` lint-fixes the file.
- Allowed without asking: lint, typecheck, tests, `git status`, `git diff`, `git log`.
- Asked first: commit, push, deleting files, GitHub writes (`gh pr`, `gh issue`, `gh label`, `gh project`,
  `gh release`, `gh api` with a write flag), dependency changes, and edits to migrations, auth, CI, Docker, Git hooks,
  `package.json` and agent settings.
- Denied: reading `.env*` and database files, force pushes, pushes to `main` or `develop`, `--no-verify`, and the
  Playwright tool that runs arbitrary code.

> ASSUMPTION: permission modes that skip prompts (auto mode, `--dangerously-skip-permissions`) also skip the "ask"
> rules; the "deny" rules still apply. Keep the default mode when you want the gates.

## Personal setup

1. Node 24 and Corepack, as in [CONTRIBUTING.md](../CONTRIBUTING.md#setup).
2. The GitHub CLI, signed in: `gh auth login`, then `gh auth refresh -s project` so agents can add issues to the
   GitHub Project, and `-s workflow` if you push changes under `.github/workflows/`.
3. The Chromium build the Playwright MCP uses: `npx @playwright/mcp@0.0.86 install-browser chromium` (without the
   `--browser chromium` flag it looks for Google Chrome).
   > ASSUMPTION: the `install-browser chromium` form; its release notes show it for `chrome` and `ffmpeg`.
4. Commit signing configured in Git (merges into `develop` and `main` require signed commits).
5. Optional: `CLAUDE.local.md` and `.claude/settings.local.json` for your own rules and permissions, both gitignored.
   Personal MCP servers and plugins go in your user settings, not in the repository.

No token or secret is committed: MCP servers here need none, and `gh` uses your own login.
