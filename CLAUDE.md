# WorkerBee - Claude Code Project Guide

## Project Overview

WorkerBee is a TypeScript library for Hive blockchain automation built on `@hiveio/wax` and `@hiveio/beekeeper`. It provides an event-based observer pattern for building bots that react to blockchain events (posts, votes, transfers, account changes, etc.) with support for both real-time streaming and historical data processing.

## Tech Stack

- **Runtime:** Node.js 20.11+ or 21.2+
- **Language:** TypeScript (ESM only)
- **Package Manager:** pnpm 10.0.0+
- **Build:** Rollup + Terser + size-limit (181 kB max)
- **Testing:** Playwright
- **Linting:** ESLint 9 (flat config)
- **Core Dependencies:**
  - `@hiveio/wax` - Hive blockchain interface
  - `@hiveio/beekeeper` - Wallet/key management (dev)

## Directory Structure

```
src/
├── index.ts              # Entry point (re-exports)
├── bot.ts                # WorkerBee main class
├── queen.ts              # QueenBee observer builder (live data)
├── past-queen.ts         # PastQueen (historical data)
├── interfaces.ts         # Core type definitions
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
```

## Key Files

| File | Purpose |
|------|---------|
| `src/bot.ts` | Main WorkerBee class - start/stop/broadcast/iterate |
| `src/queen.ts` | QueenBee fluent API for filter subscriptions |
| `src/interfaces.ts` | IWorkerBee interface and core types |
| `src/chain-observers/filters/` | All filter implementations |
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

**Dependency:** `hiveio-wax>=2.0.2`

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
