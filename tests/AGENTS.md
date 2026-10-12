# Tests

- Test names state the acceptance criteria ("given … when … then …" or plain sentences), not the implementation.
- Prefer real objects over mocks; mock only the network and the clock.
- Fixtures come from `tests/factories/` and the fictional demo stack. Never use real IPs, domains or hostnames.
- Unit tests sit next to their code (`*.test.ts`); `tests/unit/` holds tests that span several modules.
- A test that fails for the right reason first is worth more than a test written after the code.
