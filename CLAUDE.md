@AGENTS.md

## Claude Code

- Skills: `/spec` writes the temporary spec and stops for approval; `/tdd` drives red → green → refactor from an
  approved spec; `/new-component` scaffolds a component with its story and translations; `/commit` and `/pr` follow
  the conventions.
- Subagents: `a11y-reviewer`, `security-reviewer` and `i18n-checker` review changes before a pull request.
- Hooks (`.claude/settings.json`): the TDD guard blocks edits to untested source, and edited files are lint-fixed
  automatically; fix whatever the lint hook reports.
- Personal overrides go in `CLAUDE.local.md` and `.claude/settings.local.json` (both gitignored).
