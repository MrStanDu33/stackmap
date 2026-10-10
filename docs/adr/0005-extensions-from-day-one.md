# 5. Extensions from day one

- Status: accepted
- Date: 2026-10-10

## Context

Beginners need a simple interface; power users need more entity types and integrations. Adding modularity after the
features exist would mean rewriting most of them.

## Decision

- The core and the **built-in extensions** use the same SDK (`packages/extension-sdk`): built-in extensions are Nuxt
  layers in `extensions/<id>/` with a Zod-validated manifest.
- Extensions contribute entity types, fields on core entities (in their own tables), kinds, flow types, flow derivers,
  trace hop resolvers, templates, wizard questions, themes and locales. Built-in extensions may also contribute code
  (connectors, notifiers, checks).
- Workspace admins turn extensions on or off. Turning one off never deletes data (see `docs/ARCHITECTURE.md`).
- **Custom** extensions are declarative only; custom entity types ship in v1.
- **External** (third-party) extensions come later, after a security review. No third-party code will run inside the
  app process or the browser: they will run as sidecar containers or be built into a custom image.

## Consequences

- Flow derivation and traces work through extension contributions, not hard-coded entity types.
- Every built-in extension has SDK contract tests.
