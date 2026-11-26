---
name: spec
description: Write the spec of a feature or fix before any code, stop for the user's approval, then post it as a Spec issue. Use at the start of every feature or behavior change.
argument-hint: <feature or bug in a few words>
---

# Write a spec

1. **Size it.** Feature (new behavior), fix (behavior that is wrong) or chore (dependencies, CI, docs, refactor with
   no behavior change). A chore needs no spec: say so and stop. When unsure, ask.
2. Read the relevant parts of `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and the existing code.
   List the open design questions and ask them first; flag anything that departs from the architecture.
3. Create `.ai/specs/<slug>.md` (gitignored), starting with a `Status / next step:` line, with the sections of
   `.github/ISSUE_TEMPLATE/spec.yml`:
   - **Goal**: one or two sentences. For a fix: the bug and the expected behavior.
   - **Acceptance criteria**: numbered, in Given/When/Then. Each one becomes a test name. For a fix, the first one is
     the test that reproduces the bug.
   - **Data and API contracts**: entities, fields, Zod schemas, routes, roles allowed, Problem Details codes.
   - **UI states**: default, loading, empty, error, and each role's view.
   - **Accessibility**: keyboard path, labels, announcements, the accessible equivalent of any visual (RGAA 4.1,
     WCAG 2.2 AA: no drag without a single-pointer alternative, 24 px targets).
   - **Translations**: the new strings, in English and French.
   - **Edge and error cases**.
   - **Out of scope**.
   - **Slices and pull requests**: the smallest shippable parts in build order, one PR each (about 400 changed lines
     at most, outside tests, locales and generated files). Propose a split whenever parts are independent.

   A fix keeps only Goal, Acceptance criteria and Edge cases (plus contracts if they change).
4. Use fictional data only (documentation and private IP ranges, `.example` names): the spec becomes a public issue.
5. Show the spec to the user and **stop**. Do not write tests or code until they approve it.
6. Once approved, ask to post it, then: write the issue body to a file in your scratchpad with one `### <Section>`
   heading per form field, and run
   `gh issue create --title "<Feature or fix in a few words>" --label spec --body-file <file>`.
   Record the issue number in the spec's status line. Later approved changes are edited into the issue
   (`gh issue edit <n> --body-file <file>`), after asking.
7. Continue with `/tdd`.
