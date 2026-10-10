---
name: pr
description: Open a pull request into develop with the template filled in. Use when a branch is ready for review.
---

# Pull request

1. Check the branch name (`feature-<slug>`, `fix-<slug>`, `chore-<slug>`) and that it is pushed.
2. Run `pnpm lint`, `pnpm lint:css`, `pnpm typecheck` and `pnpm test`; fix failures first.
3. Title: it becomes the squash commit on develop, so it follows the commit convention (`<gitmoji> <Title>`).
4. Body: fill in `.github/PULL_REQUEST_TEMPLATE.md` honestly: what and why, the checklist, and tick "AI assistance".
5. Show the title and body to the user, then run `gh pr create --base develop`.
