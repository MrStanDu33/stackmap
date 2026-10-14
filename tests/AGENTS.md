# Tests

- Test names state the acceptance criteria ("given … when … then …" or plain sentences), not the implementation.
- Prefer real objects over mocks; mock only the network and the clock.
- Fixtures come from the factories (`extensions/core/testing`: `buildX` for input, `createX` to store it) and the
  fictional demo stack (`server/demo/`). Never use real IPs, domains or hostnames: documentation or private ranges,
  `.example` names.
- Repository tests call `useTestWorkspaces(dialect)` (`tests/support/workspaces.ts`): a database migrated like the
  app, with workspaces A and B and their repositories, per test.
- Unit tests sit next to their code (`*.test.ts`); `tests/unit/` holds tests that span several modules.
- A test that fails for the right reason first is worth more than a test written after the code.
