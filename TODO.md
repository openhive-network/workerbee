# TypeScript Fixes Backlog

This branch is dedicated to TypeScript-side fixes and follow-up work discovered
while porting WorkerBee to Python. The Python branch must not carry these TypeScript
changes.

## Fixed On This Branch

- Block collector catch-up can no longer skip missing blocks after a partial range
  response. Fixed by `[TS] Fix block collector catch-up range`.
  - Main code: `src/chain-observers/collectors/jsonrpc/block-collector.ts`
  - Regression tests: `__tests__/detailed/jsonrpc_block_collector_tests.ts`
  - Scenario wiring: `__tests__/detailed/realistic_scenarios.ts`,
    `__tests__/index.spec.ts`

- Feed price refresh now follows the expected refresh cadence instead of refreshing
  at the wrong block boundary. Fixed by `[TS] Fix feed price refresh cadence`.
  - Main code: `src/chain-observers/collectors/jsonrpc/feed-price-collector.ts`
  - Regression tests: `__tests__/detailed/feed_price_collector_tests.ts`

- Account-scoped stateful filters no longer leak previous account state between
  accounts watched by the same filter instance. Fixed by
  `[TS] Track account filter state per account`.
  - Main code: `src/chain-observers/filters/account-metadata-change-filter.ts`,
    `src/chain-observers/filters/balance-change-filter.ts`
  - Regression tests: `__tests__/detailed/stateful_filter_tests.ts`

- Composite OR filters now match when any branch matches, instead of evaluating
  as an accidental AND. Fixed by `[TS] Fix composite OR evaluation`.
  - Main code: `src/chain-observers/filters/composite-filter.ts`
  - Regression tests: `__tests__/detailed/composite_filter_tests.ts`

- Observer listener `next` callbacks are awaited during normal notification
  delivery. Fixed by `[TS] Await observer listener notifications`.
  - Main code: `src/chain-observers/observer-mediator.ts`
  - Regression tests: `__tests__/detailed/observer_mediator_tests.ts`

- Type-only imports are now marked with `import type`, so Playwright test discovery
  does not try to load erased TypeScript types at runtime. Fixed by
  `[TS] Use type-only imports for erased types`.
  - Main code: many `src/**/*.ts` and `packages/**/*.ts` files that imported
    compile-time-only symbols as runtime values.
  - Motivation: `npx playwright test --list --project=workerbee_testsuite`
    failed before collecting tests when `TRegisterEvaluationContext` was imported
    as a runtime value.

## Still Open

- Replace or harden observer tests that can pass without receiving an event.
  - Evidence: several tests in `__tests__/detailed/bot_events.ts` assert only
    that a timeout result is a boolean. A timeout returning `false` can still make
    the test green.
  - Expected fix: make emission tests deterministic and assert the promised event,
    or rename them as smoke tests and add separate deterministic coverage.

- Await listener `error` callbacks in the outer mediator error path.
  - Evidence: normal listener `next` callbacks are awaited, but the
    `preNotify`/`postNotify` error path in `src/chain-observers/observer-mediator.ts`
    still calls `listener.error` without awaiting it.
  - Expected fix: collect and await async error callbacks consistently, including a
    regression where `postNotify` fails and the error handler finishes later.

- Add second-account positive coverage for stateful metadata filters.
  - Evidence: current regression coverage guards against false positives for the
    second watched account, but should also prove that changing only the second
    account is detected.
  - Expected fix: after initialization, change only the second account's
    `json_metadata` and `posting_json_metadata`, and assert a positive match.

- Track quarantined or skipped TypeScript scenarios with explicit owners or expiry
  criteria.
  - Evidence: mock realistic scenarios contain expected-failing or TODO coverage.
  - Expected fix: attach issue IDs, expiry dates, or replacement deterministic
    coverage so CI cannot stay green indefinitely while behavior is untested.

- Enable Playwright `forbidOnly` in CI.
  - Evidence: `package.json` unsets `CI` for Playwright and
    `playwright.config.ts` does not set `forbidOnly`.
  - Expected fix: add `--forbid-only` to the test script or `forbidOnly: true` to
    the Playwright config.

- Add whole-branch spelling coverage for tracked source and docs.
  - Evidence: the Python pre-commit spelling scope is intentionally limited and
    root TypeScript/CI/docs content is outside that hook.
  - Expected fix: add a root-level spelling check with explicit skips for lockfiles,
    generated fixtures, vendored submodules, and historical JSON fixtures.

- Ignore Python environment and generated paths in ESLint.
  - Evidence: `eslint.config.js` does not ignore `python/`, so local runs can lint
    virtualenv or generated JavaScript artifacts if they exist.
  - Expected fix: ignore `python/**`, or at least `.venv` and generated artifact
    paths.
