# WorkerBee - Claude Code Project Guide

## Project Overview

WorkerBee is a TypeScript library for Hive blockchain automation built on `@hiveio/wax` and `@hiveio/beekeeper`. It provides an event-based observer pattern for building bots that react to blockchain events (posts, votes, transfers, account changes, etc.) with support for both real-time streaming and historical data processing.

## Working in an AIDEV workflow
When AIDEV runs you on an issue, no one is there to answer questions. GitLab CI doesn't run for AIDEV branches; the checks below are the verification.

- **Check your change:** run `aidev test run --slot quick` once, after your last edit. It runs ESLint (`--max-warnings=0`), `tsc --noEmit` (library, `packages/blog-logic` and the Playwright tests in `__tests__`), the full build (tsc, rollup, terser, size-limit) and the Playwright `workerbee_testsuite` project (89 tests on replayed API recordings, about a minute). `aidev test run --slot full` adds the typedoc API reference and the Playwright `workerbee_testsuite_mock` project (31 tests on recorded API data, about 6 minutes, as three suites split by test title); run it when you touch `src/` behaviour or tests.
- **Iterate:** `.aidev/run-checks.sh dev lint` (or `typecheck`, `build`, `test-mock`) runs one step (`test` the `workerbee_testsuite` project, `test-mock-a`/`-b`/`-c` a third of the mock project, `test-offline` the `@offline` tests). Playwright steps need `build` first.
- **No network:** suites run with `--network none`, and so can CI's `test` job. `workerbee_testsuite` tests (the `test` fixture) talk to a local node that replays `__tests__/assets/api-recordings/<file>/<title>.json.gz`; a new or changed test that calls the chain needs its recording: run it once with network access and `WORKERBEE_TEST_RECORD_FROM=https://api.hive.blog` and commit the file it writes. A test with its own local stub node and no chain calls gets the `@offline` tag instead.
- **Size limit:** `size-limit` fails the build when `dist/bundle` passes 182 kB or `dist/blog-logic` 46 kB.
- **Dependencies:** a change to `pnpm-lock.yaml`, `packageManager` or the `npm-common-config` submodule needs a new test image. Run `.aidev/runtime/build.sh --push` and put the printed reference in `.aidev/project.yaml` `environment.image` in the same commit (see `.aidev/README.md`).

## Tech Stack

- **Runtime:** Node.js 24+ (CI and the AIDEV test image take the exact version from common-ci-configuration)
- **Language:** TypeScript (ESM only)
- **Package Manager:** pnpm 10.33.0+
- **Build:** Rollup + Terser + size-limit (182 kB max)
- **Testing:** Playwright
- **Linting:** ESLint 9 (flat config)
- **Core Dependencies:**
  - `@hiveio/wax` - Hive blockchain interface
  - `@hiveio/beekeeper` - Wallet/key management (dev)

## Directory Structure

```
src/                      # @hiveio/workerbee: the core on a wax chain and JavaScript timers
├── index.ts              # Entry point (re-exports the core)
└── bot.ts                # WorkerBee main class

packages/workerbee-core/src/   # private, bundled into @hiveio/workerbee and the n8n nodes
├── bot.ts                # WorkerBeeCore - start/stop/broadcast/iterate on a given chain and runtime
├── queen.ts              # QueenBee observer builder (live data)
├── past-queen.ts         # PastQueen (historical data)
├── interfaces.ts         # Core type definitions, IWorkerBeeChain and IWorkerBeeRuntime
├── errors.ts             # Error classes
├── chain-observers/
│   ├── filters/          # 20+ blockchain event filters
│   ├── providers/        # Data extraction/enrichment
│   ├── classifiers/      # Raw data transformation
│   ├── collectors/       # Data collection strategies
│   └── factories/        # Factory pattern implementations
├── types/                # Subscribable, Iterator, Queue types
├── utils/                # Time, assets, exchange helpers
└── wax/                  # Wax chain initialization

__tests__/                # Playwright integration tests
├── detailed/             # Comprehensive test scenarios
└── assets/               # Test fixtures

examples/                 # Usage examples (block-parser, post-observer, etc.)
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Build (tsc → rollup → terser → size-limit)
pnpm build

# Lint with auto-fix
pnpm lint

# Lint strict (CI mode, fails on warnings)
pnpm lint-ci

# Run tests (requires chromium, auto-installed)
pnpm test

# Run only the mock test project (offline, recorded API data)
pnpm test:mock
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/workerbee-core/src/bot.ts` | WorkerBeeCore - start/stop/broadcast/iterate |
| `src/bot.ts` | Main WorkerBee class - the core on a wax chain and JavaScript timers |
| `packages/workerbee-core/src/queen.ts` | QueenBee fluent API for filter subscriptions |
| `packages/workerbee-core/src/interfaces.ts` | IWorkerBee interface and core types |
| `packages/workerbee-core/src/chain-observers/filters/` | All filter implementations |
| `rollup.config.js` | Bundle configuration |
| `playwright.config.ts` | Test runner setup (2 projects) |
| `eslint.config.js` | ESLint flat config |
| `.gitlab-ci.yml` | CI/CD pipeline |

## Coding Conventions

**Style:**
- 2-space indentation, double quotes, semicolons required
- 160 character max line length
- Arrow functions preferred, no `var`
- No console.log in production code

**Naming:**
- Classes: `PascalCase` (WorkerBee, QueenBee)
- Interfaces: `IPascalCase` (IWorkerBee, IFilterBase)
- Methods/variables: `camelCase`
- Private fields: `#field` or `private` keyword

**Patterns:**
- Observer pattern for event subscriptions
- Factory pattern for data collectors
- Composite pattern for filter combinations (AND/OR)
- Fluent API for filter chaining

**Types:**
- Strict TypeScript, no implicit any
- Generic types for filter/provider chains
- Discriminated unions for operation types

**Testing**
- Playwright for integration tests
- Mock data for predictable test scenarios
- **NEVER** ignore or skip tests. If they are not passing, fix them. If they are related to external services, mock those services.

## CI/CD Notes

**GitLab Pipeline Stages:**
1. `.pre` - Lint check (`--max-warnings=0`)
2. `build` - TypeScript + Rollup bundling
3. `test` - Playwright tests
4. `deploy` - npm registry publishing

**Publishing:**
- Dev: GitLab npm registry (@hiveio scope)
- Prod: npmjs.org (@hiveio/workerbee)

**Test Projects:**
- `workerbee_testsuite` - Full parallel test suite
- `workerbee_testsuite_mock` - Mock-only tests (sequential)

## Architecture Notes

**Core Flow:**
```
Block Stream → Filter Evaluation → Provider Enrichment → Subscriber Callback
```

**Key Classes:**
- `WorkerBee` - Bot instance, manages lifecycle and chain connection
- `QueenBee` - Fluent observer builder for live blockchain events
- `PastQueen` - Historical data processing with automatic live transition
- `FilterBase` - Abstract base for all event filters
- `ProviderBase` - Abstract base for data enrichment

**Subscribable Pattern:**
```typescript
bot.observe.onPosts({ author: "username" }).subscribe({
  next: (post) => { /* handle post */ },
  error: (err) => { /* handle error */ },
  complete: () => { /* cleanup */ }
});
```

## Python Port (`python/`)

Full port of the TypeScript WorkerBee library to Python, maintaining identical architecture and naming.

**Architecture:** 4-layer pipeline (Classifier → Collector → Factory → ObserverMediator)

**Runtime:** Python 3.12+, async/await throughout

**Dependency:** `hiveio-wax` - a development build of hive/wax!682, pinned in `python/pyproject.toml`; chain models are dataclasses of `hiveio_api` (assets `Asset`, dates `HiveDateTime`), operation bodies stay JSON objects as in TS

**Conventions:**
- `snake_case` methods/params (Pythonic; TS API translated): `used_contexts`, `push_options`, `has_registered`, `on_block` (TS `onBlock`)
- `PascalCase` classes: `WorkerBee`, `QueenBee`, `ObserverMediator`
- `from __future__ import annotations` in every file
- `TYPE_CHECKING` guard for annotation-only imports
- Modern typing: `list[str]`, `dict[str, object]`, `X | Y` (no `List`, `Dict`, `Optional`)
- Zero `Any` — use type aliases for complex structures
- `Awaitable[X]` not `Coroutine[None, None, X]`

**Toolchain:**
```bash
cd python/
.venv/bin/pre-commit run --all-files --config ../.pre-commit-config.yaml
.venv/bin/python -m pytest tests/unit -q
.venv/bin/python -m pytest tests/integration -q -n auto
.venv/bin/python -m coverage run -m pytest tests/unit && coverage report --include="workerbee/chain_observers/*"
```

**Testing:**
- Pure pytest, **NEVER** use `monkeypatch` or `unittest.mock.patch`
- Fake/Stub classes for mocking (fixture-based)
- All tests must pass before commit
- Coverage target: >80%

**Dev Cycle (mandatory for each change):**
1. Implement → 2. Tests → 3. Static analysis (`pre-commit`) → 4. DRY check → 5. Review → 6. All tests pass → 7. Commit

## n8n Community Node (`n8n/`)

Hive trigger and action nodes for n8n, running WorkerBee **inside the n8n
process** — no companion service. Standalone npm package, released separately.

**Key idea:** one registry, `n8n/shared/events.ts`, holds every observer
as `{tag, summary, fields, apply(chain, params)}`. The dropdowns, the parameter
validation, the catalog and the JSON Schema are all derived from it, so adding an
observer is one entry and no form edit.

**Layout:**
```
n8n/
├── nodes/Hive/          # action node: chain reads, catalog, spec preview
├── nodes/HiveTrigger/   # trigger node: in-process subscription
├── shared/              # events, compiler, catalog, schema, normalize, stream, chain, runtime
│                        # (outside nodes/: n8n lints node code against package errors)
├── workerbee-n8n/       # the chain of the bundled core without wax: JSON-RPC, api-to-proto, manabar
├── credentials/         # HiveApi (endpoint + chain ID, optional, no secrets)
├── tests/               # node --test, no browser
├── scripts/             # clean / bundle-workerbee / copy-assets
└── Dockerfile           # n8n image with the nodes preinstalled
```

**Composing filters:** the Events list is flat and each entry carries
`joinWithPrevious: or | and`, folded into AND-of-OR-groups by `spec.ts` in the
same order `QueenBee.applyAnd()` uses. WorkerBee only supports that shape (CNF,
no nesting), so no boolean tree editor is needed. Hard rule from
n8n: **never put `displayOptions` on a child of a `collection`/`fixedCollection`**
-- it breaks activation and the editor outright.

**Build shape (CommonJS nodes + ESM WorkerBee, no runtime dependencies):**
- `module: node16`, not `commonjs` — keeps dynamic `import()` from being
  rewritten to `require()`; that import is how CJS reaches the ESM library.
- wax types come through `shared/wax-types.ts`, which carries the
  `resolution-mode` attribute once instead of at every import site. wax is a
  devDependency: types and the tests comparing `workerbee-n8n` with it.
- `workerbee-n8n/index.ts` (the core of `../packages/workerbee-core` on the
  JSON-RPC chain) is bundled with esbuild into `workerbee/index.mjs`; its
  extensionless relative imports make a plain `tsc` output unloadable by Node's
  ESM loader. The bundle fails if anything imports wax or beekeeper at runtime.
- The poller runs on `sleep` of n8n-workflow (`shared/runtime.ts`), never
  on `setInterval`/`setTimeout`.

**Example with a database:** `workflows/gtg-busy-blocks.json` plus the `postgres`
service in `docker-compose.yml` (schema in `docker/postgres-init.sql`). Stock n8n
nodes only — If, If, Split Out, Postgres — no Code node. Note that Split Out spreads
an object element into the item *only* when `include: noOtherFields`; carrying
any other field means naming the element with `destinationFieldName`.

**Never** edit the library to accommodate this package beyond the seams of the core
(`IWorkerBeeChain`, `IWorkerBeeRuntime` in `packages/workerbee-core`); the registry adapts instead.
There are no runtime dependencies, as n8n's *verified* community-node programme
requires, so the nodes only read: publishing (signing needs the transaction
digest of wax), `impacted_accounts` (consensus rules compiled into wax) and the
ids of transactions are left out.

**Toolchain:**
```bash
cd n8n/
npm ci --ignore-scripts        # isolated-vm is a type-only transitive
npm run build                  # declarations of the core, esbuild bundle, tsc, assets
npm test                       # build + node --test
docker compose up -d --build   # n8n at :5678 with the nodes loaded
docker exec -i <container> node - < dev/smoke.cjs   # live end-to-end
```

**Testing:**
- `node --test`, fixture-based fakes, no mocking library
- The catalog tests compile every entry against a **real** `QueenBee` and assert
  the registry covers exactly the observers the library offers (but
  `onImpactedAccounts`) — a rename in the core must fail here, not in production
- `api-to-proto`, `manabar` tests compare `workerbee-n8n` with wax (every
  transaction of the recorded blocks in `__tests__/assets/api-recordings`)
