# Moving the n8n package into the pnpm workspace

Feasibility note, 2026-09-08. The question: wax keeps its side packages as pnpm
workspace members (`ts/packages/signers-beekeeper`); should this package do the
same, and what would it cost?

Short answer: it works — measured, not estimated — but the benefit is narrower
than it looks, and one property this package has today would be lost.

## What the wax pattern actually is

`ts/packages/signers-beekeeper/package.json`, three ingredients:

```json
"dependencies":    { "@hiveio/wax": "workspace:../.." },
"devDependencies": { "typescript": "catalog:typescript-toolset" },
"scripts":         { "prepack": "jq --slurpfile source ../../package.json '.version = $source[0].version' ..." }
```

- **`workspace:../..`** — the sub-package consumes the root package by source
  during development; pnpm rewrites it to a real version range on publish.
- **`catalog:`** — shared tool versions live once, in `pnpm-workspace.yaml`.
- **`prepack`** — the sub-package carries `0.0.0-Run-Prepack` and inherits the
  root's version at pack time.

The root `pnpm-workspace.yaml` globs `./packages/**/*`, so nothing has to be
registered by hand.

## The experiment

Moved `n8n/` to `packages/n8n-nodes-hive/`, dropped `package-lock.json`, pointed
`typescript` at the catalog, and fixed the `../src` paths (one directory
deeper). Then, in a clean container:

```
pnpm install   Done in 17.2s
build          passes
tests          111 passed, 0 failed
```

So the shape is compatible. What follows is what the experiment surfaced that
reading the config would not have.

## `packages/` is the only sane placement

`pnpm-workspace.yaml` and `.npmrc` at the repository root are **symlinks into
the `npm-common-config` submodule**, which is shared across Hive's TypeScript
projects:

```
pnpm-workspace.yaml -> ./npm-common-config/pnpm-config/pnpm-workspace.yaml
.npmrc              -> ./npm-common-config/pnpm-config/.npmrc
```

Adding `./n8n` to the workspace globs therefore means either changing the file
for every project that shares it, or replacing the symlink with a local copy and
diverging from the shared config. Putting the package under `packages/` needs
neither — the existing `./packages/**/*` glob already covers it. This is also
exactly where wax keeps its sub-packages.

## The one real surprise: engine-strict

The first `pnpm install` **failed**:

```
Expected version: >=24.0.0
Got: v22.23.2
This is happening because the package's manifest has an engines.node field
```

The shared `.npmrc` sets `engine-strict=true`. Something in `n8n-workflow`'s
tree wants Node ≥ 24; npm only warns about that, pnpm aborts. The experiment
only proceeded with `--config.engine-strict=false`.

That needs a decision, not a workaround: either the CI job and the Docker image
move to Node 24, or this package gets a documented exception. It is the item
most likely to be discovered late, because nothing in the current npm-based
setup hints at it.

## What has to be rewritten

Three places assume the package installs standalone with npm:

| Where | Assumption |
|---|---|
| `n8n/Dockerfile:30-31` | copies only `package.json` + `package-lock.json`, runs `npm ci` in isolation |
| `n8n/Dockerfile:37` | `npm run build && npm pack` |
| `.gitlab-ci.yml:85-86` | `npm ci` without the rest of the repository |

This is the bulk of the work, and the Dockerfile is the expensive one. Today the
dependency layer is keyed on two small files, so it caches across every source
change. After the move the image needs the repository root, `pnpm-lock.yaml` and
the submodule, and that layer stops being cheap.

## What does *not* transfer

Wax's `"@hiveio/wax": "workspace:../.."` has no equivalent here. pnpm rewrites
`workspace:` to a real dependency on publish, which would make
`@hiveio/workerbee` a **runtime dependency** of the published package — the exact
rule that keeps this package out of n8n's verified programme
(`no-runtime-dependencies`, see [`raport_n8n_deploy.md`](raport_n8n_deploy.md)).

So the esbuild bundle of `../src` stays either way. A workspace would make
development tidier; it would not change the dependency model, which is the part
that actually matters for publishing.

## What is lost

Today this package builds with **no submodule and no pnpm** — `npm ci` in its own
directory is enough. That is deliberate, and recorded in the comment at the top
of `tsconfig.workerbee.json`. After the move it stops being true: the package can
only be built from a full workspace checkout with the submodule initialised.

Whether that matters depends on whether anyone builds it in isolation — a
contributor packaging the node without caring about the library, or a Docker
build that wants a small context.

## Assessment

**Cost:** about half a day. Move the directory, fix the relative paths, switch to
`catalog:`, rewrite the Dockerfile and the CI job, settle the Node 24 question.

**Gained:** one source of truth for tool versions, one lockfile, `pnpm --filter`
instead of `cd n8n`, and consistency with how wax is laid out.

**Not gained:** any simplification of dependencies or of releasing. The package
is still bundled, still published on its own.

**Recommendation:** worth doing when the Node version question is settled anyway,
or if a second package appears alongside this one. Not worth doing on its own —
the standalone build is a real property being traded for tidiness.
