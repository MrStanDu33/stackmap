---
name: pr
description: Open a pull request into develop with the template filled in, after the checks and reviews. Use when a branch is ready for review.
---

# Pull request

1. Check the branch name (`feature-<slug>`, `fix-<slug>`, `chore-<slug>`), that it is rebased on `origin/develop`,
   and that the diff stays one shippable part (about 400 changed lines outside tests, locales and generated files);
   if not, propose a split.
2. Run `pnpm lint`, `pnpm lint:css`, `pnpm typecheck` and `pnpm test`; when pages or layouts changed, also
   `pnpm build && pnpm test:e2e` and `/verify-ui`. Fix failures first.
3. Run the reviewers in the background on `git diff origin/develop...HEAD`: `security-reviewer` when the server, auth
   or data handling changed, `a11y-reviewer` when components or pages changed, `i18n-checker` when strings changed.
   Fix agreed findings test-first; list deferred ones with their reason in the body.
4. Docs check: architecture, a command, a convention or a rule changed → `docs/ARCHITECTURE.md`, `AGENTS.md` (or a
   scoped one), `CONTRIBUTING.md` are updated in this branch; a shipped slice is ticked in `docs/ROADMAP.md`; a major
   decision has an entry in `docs/DECISIONS.md`.
5. Title: it becomes the squash commit on develop, so it follows the commit convention (`<gitmoji> <Title>`).
6. Body: fill in `.github/PULL_REQUEST_TEMPLATE.md` honestly: what and why, `Closes #<spec issue>` (or `Part of #…`
   for one slice), the checklist, and tick "AI assistance". Say why any new dependency is needed.
7. Show the title and body to the user. Only once they agree: push (asking first) and run
   `gh pr create --base develop --title "<title>" --body-file <file>`.
