---
name: commit
description: Write a commit that follows the project conventions (gitmoji, imperative title). Use when committing.
---

# Commit

1. Review `git status` and `git diff --staged`. Stage only the files of one logical change.
2. Pick the gitmoji from gitmoji.dev that matches the change, as a Unicode emoji (✨ feature, 🐛 fix,
   🧪 failing tests, ✅ passing or updated tests, ♻️ refactor, 📝 docs, 💄 UI, ♿️ accessibility, 🌐 translations,
   🔧 config, 👷 CI, ⬆️ dependencies…).
3. Title: imperative mood completing "If applied, this commit would …", capitalized, no trailing period, header under
   80 characters. Example: `✨ Add exposure filter to the graph view`.
4. Body (optional, after a blank line): why the change was made.
5. Ask the user to confirm before committing. Never use `--no-verify`; if a hook fails, fix the cause.
