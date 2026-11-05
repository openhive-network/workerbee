# WorkerBee in n8n

This repository ships a pair of [n8n](https://n8n.io) community nodes that run
WorkerBee **inside the n8n process**:

| Node | Kind | What it does |
|---|---|---|
| **Hive Trigger** | trigger | Starts a workflow on Hive blockchain events, observed by a live WorkerBee subscription. |
| **Hive** | action | Reads chain data (account, block, chain status), serves the event catalog and its JSON Schema, and previews the spec the visual builder produces. |

Everything lives in [`n8n/`](n8n/) and is released as its own npm package,
`@hiveio/n8n-nodes-hive`. It is built on the WorkerBee core
([`packages/workerbee-core`](packages/workerbee-core/)), the same code
`@hiveio/workerbee` is built on, with a chain of its own: plain JSON-RPC calls, no
wax and no WebAssembly, so the package has no runtime dependencies at all.

---

## Running it

You need Docker. You do **not** need Node, npm or a local n8n.

```bash
cd n8n
docker compose up -d --build
```

Open <http://localhost:5678>. On first run n8n asks you to create a local owner
account; that account is yours alone and stays in the container's volume.

**Hive** and **Hive Trigger** are in the node panel straight away. There is no
second service to deploy and no credential to fill in — an unconfigured node
talks to the public `https://api.hive.blog/`.

Five ready-made workflows are in [`n8n/workflows/`](n8n/workflows), from "show me
a block" to a Discord digest; the whole directory imports in one command. What each is for, what it needs, and the traps each one exists to
demonstrate: [`n8n/workflows/README.md`](n8n/workflows/README.md).

A few knobs, all optional (`cp .env.example .env` first):

| Variable | Default | Meaning |
|---|---|---|
| `N8N_PORT` | `5678` | Host port. |
| `N8N_VERSION` | `2.36.5` | n8n base image tag. |
| `N8N_LOG_LEVEL` | `info` | Subscriptions log their start and stop at `info`; `debug` adds one line per node load. |
| `TZ` | `UTC` | Timezone for schedules and log timestamps. |
| `N8N_SECURE_COOKIE` | `true` | Set `false` to reach the editor over plain HTTP — a LAN address, an SSH tunnel. |
| `POSTGRES_PASSWORD` | `hive` | Database the `gtg-busy-blocks` example writes to. Not n8n's own. |

### Rebuilding after a change

```bash
cd n8n
docker compose up -d --build
```

The dependency layer is cached, so a rebuild is a TypeScript compile plus a copy
— seconds, not minutes. That depends on the `.dockerignore` at the repo root:
the compose file builds with `context: ..`, so without it the whole checkout —
`node_modules`, `dist`, the Python venv, the git history — is re-sent to the
daemon every time, and the host's `n8n/node_modules` lands on top of the
dependency layer the image just built. This is also the command to run after editing anything
under `packages/workerbee-core/`, because the image compiles the library from source.

### Checking that the nodes actually loaded

```bash
docker compose logs n8n | grep 'n8n-nodes-hive'
docker compose exec n8n ls /home/node/.n8n/nodes/node_modules/@hiveio/n8n-nodes-hive/dist/nodes
```

You should see `Hive`, `HiveTrigger` and `shared`. The clearest signal is in the
editor, though: drop a **Hive** node, pick `Catalog → Get Events`, and execute
it. It answers with every event and provider the trigger can watch, straight out
of the registry described below — no network call involved.

### Starting over

```bash
cd n8n
docker compose down -v      # -v also wipes the n8n user data volume
docker compose up -d --build
```

---

## How the integration works

### One registry drives everything

`n8n/shared/events.ts` holds one entry per WorkerBee observer:

```ts
{
  tag: "posts",
  kind: "event",
  summary: "Fires when one of the authors publishes a top-level post.",
  fields: [{ name: "authors", type: { kind: "names" }, description: "Authors to watch" }],
  apply: (chain, params) => chain.onPosts(...params.names("authors")),
}
```

From that single table come the dropdowns, the parameter names and their types,
the validation, the human-readable catalog, the JSON Schema, and the compilation
into a real observer chain. **Adding an observer is one entry and no form edit.**

Two properties fall out of the shape rather than from discipline:

- A user-supplied string is never used to look up a method. The entry carries its
  own `apply`, so `queen[whateverTheUserTyped]` cannot happen.
- The registry is pinned to the real `QueenBee` type, so renaming an observer in
  the core breaks *this* build instead of shipping a node that throws at runtime.
  The catalog tests go further and compile every entry against a real `QueenBee`.

### Composing conditions

WorkerBee composes filters as an AND of OR-groups — `a.or.b.and.c` means
`(a OR b) AND c`, with no nesting. The Events list mirrors exactly that: it is a
flat list, and each entry says how it joins the one above it (`Or` keeps the
group, `And` closes it and starts the next). Read top to bottom, the form and the
equivalent WorkerBee chain say the same thing in the same order.

That is why there is no boolean tree editor here: the library cannot express one.

### Read only, without WebAssembly

The nodes only read. Three things WorkerBee can do need wax and its
WebAssembly, so they are left out until there is a way to do them without it:

- **Publishing** (`Comment: Reply` and the Hive Posting Key credential): signing
  needs the digest of a transaction, which only wax computes, and beekeeper only
  signs digests.
- **`impacted_accounts`**: which accounts an operation touches is the consensus
  logic of hived, compiled into wax.
- **Ids of transactions**: WorkerBee does not need them for reading — a block
  carries the ids of its transactions.

The rest of what WorkerBee takes from wax is reimplemented in
[`n8n/workerbee-n8n/`](n8n/workerbee-n8n/) and compared with wax in the tests:
the protobuf form of the transactions of a block (on every transaction of the
blocks the library's tests replay) and the current value of a manabar.

### One block stream per endpoint

WorkerBee's `ObserverMediator` already multiplexes any number of listeners over a
single block stream, so the nodes keep one reference-counted bot per Hive
endpoint for the whole n8n process. Fifty workflows watching Hive cost one poller,
not fifty; deactivating the last workflow on an endpoint really does stop the
traffic to it. Action-node reads borrow the same connection.

### Back-pressure

WorkerBee calls a subscriber synchronously while it walks a block, so the trigger
never does consumer-sized work in that callback. Items go into a bounded queue
instead (`Max Queue`, default 500). When a workflow is slower than the chain the
overflow policy applies — drop oldest or drop newest — and drops are **counted
and logged**, never silently absorbed.

### Payloads n8n can actually read

Raw WorkerBee payloads contain iterator wrappers, `Date` objects, numbers past
2^53 and numeric enum members used as object keys. `shared/normalize.ts` walks
each payload once and emits plain JSON: iterables become arrays, big integers
become strings so an expression cannot quietly round them, and enum ordinals
become their names (`manabarData.alice.RC`, not `manabarData.alice["2"]`).

### CommonJS nodes, an ESM library

n8n `require()`s a compiled node, while the WorkerBee build is ESM. Four
consequences, all of them deliberate:

- `tsconfig` uses `module: node16`, not `commonjs`, so a dynamic `import()` is
  emitted as an `import()` instead of being rewritten to `require()`. That import
  is how the CommonJS node reaches the ESM library, and nothing loads while n8n is
  merely scanning the nodes directory.
- wax types (wax is a development dependency only) come through
  `shared/wax-types.ts`, which carries the `resolution-mode` import
  attribute once instead of at every import site.
- The core with `n8n/workerbee-n8n` is bundled with esbuild into
  `workerbee/index.mjs`, because a plain `tsc` output keeps extensionless relative
  imports that Node's ESM loader refuses. The bundle fails to build if anything
  imports wax or beekeeper at runtime.
- The block poller and the delays run on `sleep` of n8n-workflow
  (`shared/runtime.ts`), not on `setInterval` / `setTimeout`, which a
  community node must not use.

### How the container gets the nodes

The image builds the package and stages it, with its `node_modules`, at
`/opt/hive-nodes`. On each start the entrypoint copies it into
`$N8N_USER_FOLDER/.n8n/nodes` — the community-package layout n8n discovers — but
only when the staged build id differs from the installed one.

The copy matters. That directory is also where deployments mount their data
volume, and a named volume is seeded from the image only the first time it is
created, so nodes baked straight into the image would go stale the moment the
image was rebuilt. The build id is a hash of the packed tarball rather than the
package version, because during development the version rarely moves while the
code does — and a version check would keep serving the previous build, silently.

---

## Working on the nodes without Docker

```bash
cd n8n
npm ci --ignore-scripts   # isolated-vm is a type-only transitive; skip its node-gyp build
npm run build             # declarations of the core, esbuild bundle, tsc, assets
npm test                  # build + node --test, no browser
```

Tests use `node --test` with fixture-based fakes and no mocking library. The
catalog tests compile every registry entry against a **real** `QueenBee` and
assert that the registry covers exactly the observers the library offers, so a
rename in the core fails there rather than in production.

---

## Publishing status

The package installs into any self-hosted n8n today. Getting *verified* by n8n is
a different bar. The technical blockers are gone: no runtime dependencies and no
restricted globals. What is left is the publishing itself — the `author` of
`package.json`, a public GitHub repository and npm provenance; see *Publishing*
in [`n8n/README.md`](n8n/README.md).
