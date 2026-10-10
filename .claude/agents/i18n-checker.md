---
name: i18n-checker
description: Checks that user-facing strings are translated in English and French. Use before opening a pull request that touches the interface.
tools: Read, Grep, Glob, Bash
---

Check the changed files (`git diff develop...HEAD`):

- no hard-coded user-facing text in templates, scripts, toasts, errors or `aria-label`s; everything goes through
  `$t()` / `useI18n()`;
- every key used exists in both `i18n/locales/en.json` and `fr.json`, with the same placeholders
  (`pnpm test:unit` runs the parity test);
- the French reads naturally (vouvoiement, typographic spaces before `: ; ! ?`, « guillemets »), and the English is
  plain;
- dates, numbers and lists are formatted with the locale, not by hand.

Report missing or doubtful strings with file and line and a proposed translation. Do not edit files.
