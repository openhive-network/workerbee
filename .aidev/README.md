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
| `typecheck` | `tsc --noEmit` for `src/` and `packages/blog-logic` |
| `build` | package.json `build` without `prebuild`: tsc, rollup, terser, size-limit |
| `dist-exports` | (after `build`) the files package.json `main`/`types`/`exports` name exist |
| `docs` | the API reference with typedoc, as CI's `generate_docs` |
| `test-mock` | Playwright project `workerbee_testsuite_mock`: 31 tests on recorded API data |
| `test`, `test-all` | Playwright project `workerbee_testsuite` (89 tests), or both projects |

| Slot | Steps |
|---|---|
| quick, canary | lint, typecheck, build, test-mock |
| full | lint, typecheck, build, docs, test-mock |
| static | lint, typecheck |
| baseline, coverage | build, test-mock |
| system | build, docs |

**Not bound:** the `workerbee_testsuite` project (`test`). Its tests call the live
`api.hive.blog`, and AIDEV runs suites with `--network none`; offline, 74 of its 89
tests fail. CI runs it with network access. Binding it needs either recorded API
data for those tests (as `workerbee_testsuite_mock` has) or a decision to give the
suites network access. There is no coverage tool, so `coverage` measures nothing
yet. The Python package in `python/` (poetry, its own CI jobs) isn't bound either.

## The test runtime image (`runtime/`)

The suites run in a container with `--network none` and your uid. The image is the
one CI's npm jobs use (`common-ci-configuration` `emsdk:4.0.22-5`: Node 22.21.1,
pnpm 10.0.0), plus a pnpm store filled with `pnpm fetch`, the Chromium build the
locked Playwright needs, and a copy of the `npm-common-config` submodule.
`pnpm-deps.sh` installs `node_modules` offline from the store, and copies the
submodule in when the checkout hasn't initialised it (`.npmrc`, `pnpm-workspace.yaml`
and the tsconfig base are symlinks into it).

When `pnpm-lock.yaml`, `packages/blog-logic/package.json`, `packageManager`, the
`npm-common-config` submodule commit or `runtime/Dockerfile` change, rebuild and
re-pin **in the same commit**:

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
