# Python Test Contribution Notes

The Python tests are part of the WorkerBee TypeScript-to-Python port. The TypeScript test suite and implementation are the source of truth for behavior and test methodology. Python tests should prove equivalent behavior, not invent a separate testing architecture.

## Test Scope

- Keep unit tests in `python/tests/unit`, live mirrornet integration tests in
  `python/tests/integration`, and recorded JSON-RPC mock tests in
  `python/tests/mock`.
- Do not add tests that only check constants, schema shapes, imports, README snippets, or CI configuration.
- Avoid fake-green tests: every test must exercise observable behavior and fail for a realistic regression.
- Prefer TS-matching scenarios and names when a TypeScript equivalent exists.
- If a Python behavior differs from TypeScript, document the reason in the test or fix the implementation.

## Integration Tests

- Do not depend on `test_tools` or custom local `hived` nodes.
- Integration tests should use mirrornet/live RPC fixtures or recorded JSON-RPC responses.
- Use the shared mirrornet fixtures from `python/tests/integration/conftest.py`.
- Do not hardcode `https://api.hive.blog` in test files. Use the `--workerbee-mirrornet-endpoint` option or `WORKERBEE_MIRRORNET_ENDPOINT`.
- Do not duplicate mirrornet chain setup; use `mirrornet_chain`, `workerbee`, `inactive_workerbee`, or `mirrornet_replay`.
- Avoid per-file `_run_replay` helpers. Put shared replay behavior in the integration fixtures or `_mirrornet.py`.
- Avoid long sleeps and open-ended waits. Prefer deterministic block ranges, bounded waits, and explicit assertions that blocks or notifications progress.
- Port live TS checks as live mirrornet tests only when the assertion is stable
  on a public RPC endpoint. Cases that depend on mutable node state or waiting
  for an account/feed/witness change should be covered with recorded JSON-RPC
  mock tests or focused unit tests instead of fragile live polling.

## Unit Tests

- Use fixtures for reusable objects instead of `_make_*` helper methods or test-class factory methods.
- Prefer parametrization over many tiny tests that repeat the same setup.
- Keep imports at module scope unless the test specifically validates import-time behavior.
- Do not hide setup in aliases that obscure the actual type or behavior under test.

## Typing

- Avoid `Any`. Use concrete test doubles, protocols, aliases, or project payload types.
- Prefer high-level domain types such as `ObserverNotification`, `OperationsPerType`, and `OperationBodiesByAccount` over `dict[str, object]`.
- If an imprecise type is unavoidable, narrow it at the boundary and keep the rest of the test strongly typed.
- Fixture return types should match the actual fixture object.

## Assertions

- Assert the behavior promised by the test name.
- Avoid shape-only assertions unless the shape itself is the public behavior being tested.
- For replay/block tests, assert that new blocks advance instead of only asserting that a callback ran.
- For subscription tests, assert the actual notification/filter effect, not just that a pipeline can be constructed.
