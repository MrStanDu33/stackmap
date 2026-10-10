---
name: tdd
description: Implement an approved spec test-first (red, green, refactor). Use after /spec has been approved.
argument-hint: <path to .ai/specs/*.md>
---

# Test-driven implementation

1. Read the approved spec in `.ai/specs/`.
2. **Skeletons**: write one test per acceptance criterion, named after it, as `it.todo(...)` (or Playwright
   `test.fixme(...)`), in the right layer: unit next to the code, stories for components, integration for routes,
   e2e for user journeys. Show them to the user.
3. **Red**: turn the skeletons into real tests. Run them (`pnpm test:unit`, `pnpm test:stories`…) and confirm each one
   fails for the expected reason, not because of a typo or a missing import. Commit: `✅ Add tests for <feature>`.
4. **Green**: write the minimum code to pass. Run the tests until they pass. Never change a test to make it pass; if
   a test is wrong, say so and ask.
5. **Refactor**: improve names and structure with the tests passing. Run `pnpm lint`, `pnpm typecheck` and the tests.
6. Commit the implementation (`✨`, `🐛`…), following the commit conventions.

The TDD guard hook blocks source edits until a matching test exists: write the test first.
