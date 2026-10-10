# Server

- Domain logic lives in `server/domain/` as plain functions without Nitro or database imports; it needs 90% coverage
  and is mutation-tested nightly.
- Every route is contract-first: import its Zod schemas and metadata from `shared/contracts/`.
- Every query goes through a workspace-scoped repository. Never query by ID without the workspace.
- One code path for SQLite and Postgres: no dialect-specific SQL; JSON, dates and booleans go through the serialize
  helper.
- Check the caller's role on every route; tests cover each role and cross-workspace access.
