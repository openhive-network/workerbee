# workerbee under AIDEV

AIDEV verifies changes to this library through the slots in `project.yaml`, integrates
them into `aidev/integration`, and people merge that into `main` through merge
requests. GitLab CI doesn't run for AIDEV branches; see `.gitlab-ci.yml` `workflow:`.

## Suites

`.aidev/run-checks.sh <suite> <step>...` runs the named steps and writes
`test-results/<suite>/junit.xml` (one test case per step, the step's log tail as the
failure body) and, for the Playwright steps, `test-results/<suite>/playwright-junit.xml`
(one case per test).

| Step | What |
|---|---|
| `lint` | ESLint, `--max-warnings=0` (package.json `lint-ci`) |
| `typecheck` | `tsc --noEmit` for `src/`, `packages/blog-logic` and the Playwright tests (`__tests__/tsconfig.json`) |
| `build` | package.json `build` without `prebuild`: tsc, rollup, terser, size-limit |
| `dist-exports` | (after `build`) the files package.json `main`/`types`/`exports` name exist |
| `docs` | the API reference with typedoc, as CI's `generate_docs` |
| `test-mock` | Playwright project `workerbee_testsuite_mock`: 31 tests on recorded API data |
| `test-mock-a`, `-b`, `-c` | the same project split in three by test title (3.x and 6.x; 4.x and 5.x; the rest) |
| `test`, `test-all` | Playwright project `workerbee_testsuite` (89 tests, replayed API recordings), or both projects |
| `test-offline` | the `workerbee_testsuite` tests tagged `@offline` (7): they need no recording either |

| Slot | Steps |
|---|---|
| quick, canary | lint, typecheck, build, test |
| full | suites: `checks` (lint, typecheck, build, docs, test), `mock_a`, `mock_b`, `mock_c` (build, test-mock-a/b/c) |
| baseline | suites: `mock_a`, `mock_b`, `mock_c` |
| coverage | build, test-mock |
| static | lint, typecheck |
| system | build, docs |

`test-mock` takes about 6 minutes: it is one file, run serially on a fixed mock port
(28091), as CI's config has it, so neither more workers nor Playwright's `--shard`
can split it. AIDEV's gates give each non-pytest suite about 300 s (ai/aidev#14667),
so `full` and `baseline` run it as three suites of about 2 minutes, split by test
title; `test-mock-c` uses `--grep-invert` of the other two, so a new test always
runs somewhere. Quick and canary (also 300 s) don't run it.

`test` (the `workerbee_testsuite` project, about a minute on 4 workers) needs no
network: the `test` fixture in `__tests__/assets/jest-helper.ts` points the bot at a
local node that replays each test's JSON-RPC calls from
`__tests__/assets/api-recordings/<test file>/<test title>.json.gz`. A test whose calls
aren't recorded fails with a `has no response recorded` error. Record them by running
the tests with network access and `WORKERBEE_TEST_RECORD_FROM=https://api.hive.blog`:
a passing test saves the calls it made beyond its recording (delete the file to record
a test afresh). Tests that make no chain calls, or bring their own local stub node,
carry `{ tag: "@offline" }` and need no recording. There is no coverage tool, so
`coverage` measures nothing yet. The Python package in `python/` (poetry, its own CI
jobs) isn't bound.

## The test runtime image (`runtime/`)

The suites run in a container with `--network none` and your uid. The image is
`common-ci-configuration`'s `node-test-tools:develop` (Node and pnpm at the versions
ccc's `docker-bake.hcl` defines; this repository pins neither), plus a pnpm store
filled with `pnpm fetch`, the Chromium build the locked Playwright needs, and a copy
of the `npm-common-config` submodule.
`pnpm-deps.sh` installs `node_modules` offline from the store, and copies the
submodule in when the checkout hasn't initialised it (`.npmrc`, `pnpm-workspace.yaml`
and the tsconfig base are symlinks into it).

When `pnpm-lock.yaml`, `packages/blog-logic/package.json`, `packageManager`, the
`npm-common-config` submodule commit or `runtime/Dockerfile` change, rebuild and
re-pin **in the same commit**. The input hash also covers the current digest of
`node-test-tools:develop`, so after ccc publishes a new Node, `build.sh --push`
builds a new image to re-pin:

```bash
git submodule update --init npm-common-config
.aidev/runtime/build.sh --push   # registry digest if aidev-<input hash> exists, else build + push
# put the printed repo@sha256:<digest> into project.yaml environment.image
```

Run a suite by hand the same way AIDEV does:

```bash
docker run --rm --network none --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD":/work -w /work <environment.image> .aidev/run-checks.sh quick lint typecheck build test-mock
```
