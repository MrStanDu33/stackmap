---
name: commit
description: Stage one commit that follows the project conventions (gitmoji, imperative title) and propose its message. Use whenever work is ready to commit.
---

# Commit

1. Review `git status` and `git diff`. Stage only the files of one logical change, one gitmoji concern. When red and
   green changes share a file, stage the right part with a saved patch (`git diff > <patch>`, `git apply --cached`),
   never `git add -N` (lint-staged refuses it).
2. Pick the gitmoji from gitmoji.dev that matches the change, as a Unicode emoji (✨ feature, 🐛 fix,
   🧪 failing tests, ✅ passing or updated tests, ♻️ refactor, 📝 docs, 💄 UI, ♿️ accessibility, 🌐 translations,
   🔧 config, 👷 CI, ⬆️ dependencies, 🔒️ security, 🔥 removal…).
3. Title: imperative mood completing "If applied, this commit would …", capitalized, no trailing period, header under
   80 characters. Example: `✨ Add exposure filter to the graph view`.
4. Body (optional, after a blank line): why the change was made. End with the co-author line your tool's
   instructions give, if any.
5. Show what is staged and the full message. **Do not commit** unless the user asks you to; by default they commit
   (and sign) themselves and tell you when it is done.
6. After "done", check `git log -1` shows the new commit before staging the next one; if it still shows the old one,
   check again, and stop if it has not moved.
7. If you are asked to commit: never use `--no-verify`; if a hook fails, fix the cause and make a new commit.
