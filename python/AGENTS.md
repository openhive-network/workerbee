# WorkerBee Python Port Agent Guide

This directory is the Python port of the TypeScript `@hiveio/workerbee` library.
Use this file as the operational guide for future agent work in `python/`.

## Source Of Truth

- The TypeScript source under `../src/` is the behavioral source of truth. Verify Python behavior against the matching TS file before changing logic.
- Documentation, old planning notes, and gap summaries are secondary. If they disagree with `src/*.ts`, trust TS.
- Python public APIs intentionally use `snake_case` even when TS uses `camelCase`.
- Keep semantic parity with TS, not literal TS/RxJS style when Python has already chosen a Pythonic API.

## Runtime Data Rules

- WorkerBee uses Hive hf26 APIs (`block_api`, `database_api`, `network_broadcast_api`), so operations are `Operation{type, value}`.
- `condenser_api`/`wallet_bridge` legacy operation envelopes are not the WorkerBee runtime shape.
- Runtime chain data comes from `hiveio_api`/`wax` models, usually `msgspec.Struct`.
- Access chain structs by attribute (`op.type`, `op.value`, `result.accounts`), not dict subscription or `.get()`.
- Do not hand-roll dataclasses, pydantic models, or TypedDicts for chain entities. First look for the model in `hiveio_api` or `wax`.
- WorkerBee-local projections and containers may use local `TypedDict`s in `workerbee/chain_observers/payloads.py`.
- Heavy `hiveio_api` model imports in library code should usually be under `TYPE_CHECKING` to preserve import time.

## Environment

- Work from `python/`. Shells may start or reset at repo root, so prefix commands with `cd /workspace/workerbee/workerbee/python`.
- The project uses Poetry 2.1.3+ with `poetry-dynamic-versioning`.
- Python floor is 3.12, enforced by `hiveio-wax`.
- `.venv` in `python/` is the project venv. Use `.venv/bin/<tool>` or `poetry run <tool>`.
- Hive Python packages come from the GitLab PyPI source in `pyproject.toml`; check connectivity before `poetry lock`.

## Quality Gates

Run from `python/` unless noted:

```bash
.venv/bin/pre-commit run --all-files --config ../.pre-commit-config.yaml
.venv/bin/python -m pytest tests/unit/test_import_time.py -q
```

For changed unit tests, run the narrow pytest target first. Run the full unit suite with:

```bash
.venv/bin/python -m pytest tests/unit -q -n auto
```

Integration tests run against a public mirrornet endpoint by default. Override it only when needed:

```bash
WORKERBEE_MIRRORNET_ENDPOINT=https://api.hive.blog .venv/bin/python -m pytest tests/integration -q -n auto
.venv/bin/python -m pytest tests/mock -q
```

`import workerbee` must stay under 100 ms. `tests/unit/test_import_time.py` is a permanent guard.

The shared static-analysis gate is `.pre-commit-config.yaml`. Keep hook versions in the `static-analysis` Poetry dependency group, not in remote hook definitions.

## Testing Practices

- Prefer focused tests that assert exact payload contents and fail on empty or wrong results.
- Unit tests should use fakes/stubs and deterministic builders. Do not use `monkeypatch` or `unittest.mock`.
- Test chain-data fixtures should build real `hiveio_api` models where practical; eager `hiveio_api` imports are fine in tests.
- Examples are linted, type-checked, and import-checked; do not run live examples as part of normal verification because they connect to public nodes or block forever.

## Typing Practices

- Keep mypy strict clean for `workerbee/chain_observers/`.
- Remove stale `# type: ignore` comments after dependency or typing changes; `warn_unused_ignores` is active through strict mode.
- `ObserverNotification` is a `TypedDict(total=False)` in `payloads.py` covering provider payload keys.
- Provider payloads should use high-level project types such as `ObserverNotification`, payload TypedDicts, and `hiveio_api` models instead of `Any`, `object`, or `dict[str, Any]` when a better type is available.
- Python cannot model the TS fluent builder's intersection-type payload accumulator. Use pragmatic payload TypedDicts and clear runtime tests.

## Architecture Map

- Entry point: `workerbee/chain_observers/bot.py`
- Fluent API: `workerbee/chain_observers/queen.py`
- Historical replay: `workerbee/chain_observers/past_queen.py`
- Dispatch: `workerbee/chain_observers/observer_mediator.py`
- Types: `workerbee/chain_observers/payloads.py`, `interfaces.py`, `enums.py`, `errors.py`
- Pipeline: classifiers -> collectors -> factories -> filters/providers -> mediator -> subscribers
- Test builders: `tests/unit/_builders.py`

## Public API Expectations

- `WorkerBee` supports async context management, async iteration over blocks, `start()`, `stop()`, `aclose()`, and `run_forever()`.
- `QueenBee` is the fluent observer builder exposed through `bot.observe`.
- `PastQueen` handles historical replay and can transition from past blocks to live observation.
- Subscriptions use typed callbacks: `subscribe(on_next=..., on_error=..., on_complete=...)`.
- Observer chains are async-iterable; pipeline errors raise out of the async iterator by default.
- `provide_past_operations(from_block, to_block)` is sync; `provide_past_operations_relative(relative_time)` is async.
- `broadcast()` uses keyword options such as `expire_in=timedelta(...)` and `verify_signatures=...`.

## Known Open Behavioral Differences

- Treat confirmed behavioral differences as separate tasks, not incidental refactors during typing or test cleanup.

## Known TS Bugs Already Fixed In Python

- JSON-RPC `BlockCollector` catch-up finishes on the advertised head after a multi-block gap. The current TS implementation shadows the outer `blocks` variable in the range branch; if that is fixed mechanically while keeping `count = head - current - 1`, it still lands one block behind. Python keeps the intended live behavior: listeners see the advertised head block. When TS is fixed, mirror the fixed TS version.

## Development Flow

1. Read the matching TS implementation before changing Python behavior.
2. Make the smallest Pythonic change that preserves TS semantics.
3. Add or update focused tests.
4. Run pre-commit, import-time, and relevant pytest targets.
5. Review diffs for accidental runtime imports, stale docs, and TS parity issues.
6. Commit only when requested, and keep unrelated local changes out of the commit.

## Repository Hygiene

- Do not edit vendored dependencies in `.venv` as a real fix; those edits disappear on reinstall.
- Do not revert unrelated user changes. Current dirty files outside your task should be left alone.
- Prefer `rg`/`rg --files` for code search.
- Keep source-provider structure mirrored to TS when the duplication exists in TS. Do not DRY Python source in ways that make it less faithful to `src/*.ts`.
