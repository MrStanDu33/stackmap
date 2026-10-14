# Server

- Domain logic lives in `server/domain/` as plain functions without Nitro or database imports; it needs 90% coverage
  and is mutation-tested nightly.
- Every route implements one contract from `shared/contracts/` with `defineContractHandler`. The handler gets validated,
  typed input and returns `{ status, body }` for a status the contract declares, including expected errors (404,
  409…); only unexpected failures throw. Tests check that every route file matches its contract.
- Get the database with `useDatabase()`; the startup plugin migrates it before the first request.
- Every query goes through a workspace-scoped repository (`server/repositories/`, built from the extensions'
  definitions), the database layer, or an extension's server code (migrations and repository callbacks); a test fails
  on a query elsewhere. Never query by ID without the workspace, and select named columns, never `selectAll`.
- One code path for SQLite and Postgres: no dialect-specific SQL; JSON, dates and booleans go through the serialize
  helper.
- Check the caller's role on every route; tests cover each role and cross-workspace access.
