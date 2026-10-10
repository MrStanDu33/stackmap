# 2. TypeScript 6 until the tooling supports TypeScript 7

- Status: accepted
- Date: 2026-10-10

## Context

TypeScript 7 (the native port) is the current release. `typescript-eslint` requires TypeScript `< 6.1`, and `vue-tsc`
relies on the JavaScript compiler API that TypeScript 7 no longer exposes. Type-aware linting and `nuxt typecheck` are
part of every check (hooks and CI).

## Decision

Pin `typescript` to `~6.0` in `package.json`. Renovate keeps it below 6.1 (`.github/renovate.json`).

## Consequences

- The editor and CI use the same TypeScript 6 compiler.
- Revisit when `typescript-eslint` and `vue-tsc` support TypeScript 7; remove the Renovate rule then.
