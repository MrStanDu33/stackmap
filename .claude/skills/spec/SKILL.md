---
name: spec
description: Write the temporary spec of a feature before any code, then stop for the user's approval. Use at the start of every feature or behavior change.
argument-hint: <feature in a few words>
---

# Write a feature spec

1. Read the relevant parts of `docs/ARCHITECTURE.md`, `docs/ROADMAP.md` and the existing code.
2. Create `.ai/specs/<feature-slug>.md` (gitignored, never committed) with:
   - **Goal**: one or two sentences.
   - **Acceptance criteria**: numbered, in Given/When/Then. Each one becomes a test name.
   - **Data and API contracts**: entities, fields, Zod schemas, routes, roles allowed, errors.
   - **UI states**: default, loading, empty, error, and each role's view.
   - **Accessibility**: keyboard path, labels, announcements, the accessible equivalent of any visual.
   - **Translations**: the new strings, in English and French.
   - **Edge and error cases**.
   - **Out of scope**.
3. Show the spec to the user and **stop**. Do not write tests or code until they approve it.
4. Once approved, continue with `/tdd`.
