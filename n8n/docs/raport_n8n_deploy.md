# What n8n requires to publish and verify this package

Research note, 2026-08-31. Two things are being conflated whenever people say
"publish to n8n", and they have very different bars:

1. **Publish to npm.** Anyone can. A self-hosted n8n installs it from the UI or
   from `~/.n8n/nodes`. There is no gate.
2. **Get it verified.** n8n reviews it, it becomes installable on n8n Cloud and
   discoverable from the nodes panel. There is a hard gate, and this package
   does not pass it today.

Sources: the n8n docs pages linked at the bottom, plus the actual rule sources
in `@n8n/scan-community-package` and `@n8n/eslint-plugin-community-nodes`, read
out of the published packages.

## The automated gate is runnable

Verification runs `npx @n8n/scan-community-package <name>`, which:

1. checks the package's **npm provenance**, and fails outright without it;
2. resolves the **GitHub repository** the attestation points at, downloads that
   commit, and lints it with the full rule set on the real `.ts` sources
   (`package.json` plus `{nodes,credentials}/**/*.{js,ts,json}`);
3. downloads the **published tarball** and lints it too, scoped to `**/*.js` and
   `package.json`, because provenance pins the source commit, not the build
   output.

The CLI only accepts a published package name, but `analyzePackage(dir,
patterns)` is exported, so the same lint can be run against a local checkout
before publishing anything. That is how the findings below were produced.

## Findings against this package

13 errors and 2 warnings, measured on 2026-08-31. Grouped by what it costs to
fix.

> **These counts predate `Comment: Reply`.** That commit added a second
> credential (`HivePostingKey`, also without an icon), a second restricted import
> (`@hiveio/beekeeper` in `wax-types.ts`) and a second runtime dependency, and
> `broadcast.ts`, `catalog.ts` and `emitter.ts` now throw package error classes
> too. The rules that fire are the same; the file lists and totals below are not
> exhaustive any more. Re-run the scan before quoting a number.

### Bookkeeping (minutes)

| Rule | Fix |
|---|---|
| `valid-author`, `community-package-json-author-missing` | add an `author` with name and email to `package.json` |

### Small code changes (an hour)

| Rule | Where | Fix |
|---|---|---|
| `cred-class-field-icon-missing`, `icon-validation` | `HiveApi.credentials.ts` | credentials need their own `icon` |
| *(new)* the runtime dependency count | `package.json` | `Comment: Reply` added `@hiveio/beekeeper` alongside `@hiveio/wax`. Nothing about the blocker changes in kind — the field still has to be empty — but bundling now means bundling two WebAssembly libraries, not one |
| `require-node-api-error` ×7 | `nodes/shared/`: `chain.ts`, `compiler.ts`, `credentials.ts`, `spec.ts` | the rule is syntactic and scans every file under `nodes/**` and `credentials/**`, so translating at the node boundary does not satisfy it — it wants no `throw new SpecError` anywhere in that tree. Clearing it means either an `INode` threaded through modules whose tests never construct one, or moving those modules out of `nodes/`. One of the seven, `chain.ts:138`, is a false positive: it is a bare rethrow after a compensating rollback, and the error it rethrows is never modified |
| `icon-prefer-themed-variants` ×2 (warning) | both nodes | `icon: { light: "file:hive.svg", dark: "file:hive.dark.svg" }` |

### The blocker

```
The "dependencies" field must be empty or absent in community node packages.
Move shared libraries to "peerDependencies" or bundle them into your build artifact
                                                @n8n/community-nodes/no-runtime-dependencies

Import of '@hiveio/wax' is not allowed. n8n Cloud does not allow community nodes
with dependencies                               @n8n/community-nodes/no-restricted-imports
```

The second one fires on `wax-types.ts`, which is a **type-only** import erased at
compile time. The rule does not care.

The rules themselves name the way out. From `no-restricted-imports.ts`:

> Dev dependencies (e.g. `vitest`) are never installed at runtime on n8n Cloud,
> so they are not subject to this rule — it targets runtime dependencies only.
> `no-runtime-dependencies` already enforces that the package's `dependencies`
> field is empty, so any external package an author uses must be a devDependency
> (bundled at build) or a peerDependency (provided by the instance).

So: move `@hiveio/wax` to `devDependencies` and bundle it, the way `../src` is
already bundled. Feasible on paper — wax has exactly one runtime dependency
(`events`), and `IWaxOptions.wasmLocation` accepts a base64 string for inlining
— but it means carrying a 2.3 MB WebAssembly blob (~3.1 MB base64) inside the
package.

### The deeper problem behind the blocker

Bundling wax is not enough, because of what else the rule set forbids. Linting
our bundled WorkerBee shows what a Cloud-grade build would have to answer for:

```
dist/workerbee/index.mjs
  4243:12  Use of restricted global 'process' is not allowed
  4282:11  Use of restricted global 'clearTimeout' ... use 'sleepWithAbort' from 'n8n-workflow'
  4307:21  Use of restricted global 'setTimeout' ... use the 'sleep' helper from 'n8n-workflow'
  4340:23  Use of restricted global 'setInterval' is not allowed
```

`setInterval` is WorkerBee's block poller. The whole point of this package is
that the poller runs in-process, and that is precisely the shape n8n Cloud
forbids.

Today this passes only on a technicality: the tarball leg globs `**/*.js`, and
our bundle is `index.mjs`. **Do not build on that.** It is a loophole in a glob,
not permission, and the source leg would catch the same code the moment the
bundle were emitted as `.js` or the pattern widened.

Related, and likely to come up in a human review even if the linter is silent:

> The code **must not** interact with environment variables or attempt to
> read/write files.

Our own code does neither. wax reads its `.wasm` from disk at startup, which
inlining would remove.

## Non-technical requirements

| Requirement | Us |
|---|---|
| Package name `n8n-nodes-*` or `@scope/n8n-nodes-*` | ✅ `@hiveio/n8n-nodes-hive` |
| Keyword `n8n-community-node-package` | ✅ |
| `n8n` attribute listing nodes and credentials | ✅ |
| MIT licence | ✅ |
| TypeScript, English only, README with usage | ✅ |
| Exactly one third-party service; a trigger alongside the main node is fine | ✅ Hive |
| Not a duplicate of an existing node; no Logic/Flow-control nodes | ✅ |
| **Public GitHub repository**, npm `repository` URL matching it | ❌ we point at `gitlab.syncad.com` |
| **Published from GitHub Actions with npm provenance** — mandatory since 2026-05-01 | ❌ no pipeline |
| npm Trusted Publishers (or an `NPM_TOKEN` secret) configured | ❌ |
| `@n8n/node-cli` ≥ 0.23.0 as a devDependency, `publish.yml` from `n8n-nodes-starter` | ❌ |
| Package author/maintainer matching between npm and the repository | ❌ no author field at all |
| Submission through the Creator Portal (creators.n8n.io/nodes) | — |

The GitHub requirement is not a formality: the scanner *fetches the attested
GitHub source* and hard-fails when it cannot, with "publish with provenance from
a public GitHub repository". A GitLab-hosted package cannot be verified.

n8n also "reserves the right to reject nodes that compete with any of n8n's paid
features". Not our situation.

## Two tracks

**Track 1 — publishable, self-hosted, lint-clean.** Everything above except the
dependency: 11 of the 13 errors, plus both warnings. The error-handling rule is
the one with a design question attached; the rest are chores.

**Track 2 — eligible for verification and Cloud.** Track 1, plus:

- bundle wax (inline the WebAssembly) and move it to `devDependencies`;
- answer `no-restricted-globals` for the block poller — which likely means
  either a WorkerBee build without `setInterval`, or accepting that this package
  is self-hosted only;
- mirror the repository to public GitHub, publish from Actions with provenance,
  configure Trusted Publishers, adopt `@n8n/node-cli`.

Track 2 is a project, not a chore, and the poller question should be settled
before any of the rest of it is started.

## Reproducing the scan

The scanner cannot be pointed at an unpublished package from the CLI, but its
analyser is exported:

```js
import { analyzePackage, SOURCE_FILE_PATTERNS } from "@n8n/scan-community-package/scanner/scanner.mjs";

await analyzePackage("/path/to/n8n", SOURCE_FILE_PATTERNS);              // source leg
await analyzePackage("/path/to/unpacked/tarball", ["**/*.js", "package.json"]); // tarball leg
```

## Sources

- [Submit community nodes](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes)
- [Verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines)
- [Building community nodes](https://docs.n8n.io/integrations/community-nodes/building-community-nodes)
- [Using the n8n-node CLI tool](https://docs.n8n.io/connect/create-nodes/build-your-node/using-the-n8n-node-tool)
- `@n8n/scan-community-package` and `@n8n/eslint-plugin-community-nodes` on npm
