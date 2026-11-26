@AGENTS.md

## Claude Code

- Plan mode for anything that touches several layers or needs a design choice; skip it for a fix with an obvious cause.
- Skills: `/spec` drafts the spec and stops for approval; `/tdd` drives skeletons → red → green → refactor from an
  approved spec; `/verify-ui` checks a page change in a browser; `/new-component` and `/new-extension` scaffold with
  stories, tests and translations; `/commit` stages one commit and proposes its message; `/pr` opens the pull request.
- Subagents, before a pull request, in the background: `security-reviewer` (server, auth, data), `a11y-reviewer`
  (components and pages), `i18n-checker` (strings). Fix agreed findings test-first.
- Hooks (`.claude/settings.json`): the TDD guard blocks edits to untested source, and edited files are lint-fixed
  automatically; fix whatever the lint hook reports. Permission rules ask before the review gates in AGENTS.md.
- MCP (`.mcp.json`): `nuxt` and `nuxt-ui` for current docs (prefer them to memory), `playwright` for browser checks,
  `storybook` only while `pnpm storybook` runs.
- Session hygiene: one session per slice; `/clear` between unrelated tasks; put findings in the docs or the spec, not
  only in the conversation.
- Personal overrides go in `CLAUDE.local.md` and `.claude/settings.local.json` (both gitignored).
