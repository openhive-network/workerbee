# WorkerBee in n8n

This repository ships a pair of [n8n](https://n8n.io) community nodes that run
WorkerBee **inside the n8n process**:

| Node | Kind | What it does |
|---|---|---|
| **Hive Trigger** | trigger | Starts a workflow on Hive blockchain events, observed by a live WorkerBee subscription. |
| **Hive** | action | Reads chain data (account, block, chain status), serves the event catalog and its JSON Schema, and previews the spec the visual builder produces. |

Everything lives in [`n8n/`](n8n/) and is released as its own npm package,
`@hiveio/n8n-nodes-hive`. Nothing in [`src/`](src/) is modified to accommodate
it — the integration adapts to the library, never the other way round.

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

Six ready-made workflows are in [`n8n/workflows/`](n8n/workflows), from "show me
a block" to a bot that answers replies on-chain; the whole directory imports in
one command. What each is for, what it needs, and the traps each one exists to
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
under `src/`, because the image compiles the library from source.

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

`n8n/nodes/shared/events.ts` holds one entry per WorkerBee observer:

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
  `src/` breaks *this* build instead of shipping a node that throws at runtime.
  The catalog tests go further and compile every entry against a real `QueenBee`.

### Composing conditions

WorkerBee composes filters as an AND of OR-groups — `a.or.b.and.c` means
`(a OR b) AND c`, with no nesting. The Events list mirrors exactly that: it is a
flat list, and each entry says how it joins the one above it (`Or` keeps the
group, `And` closes it and starts the next). Read top to bottom, the form and the
equivalent WorkerBee chain say the same thing in the same order.

That is why there is no boolean tree editor here: the library cannot express one.
The reasoning and the alternatives that were rejected are in
[`n8n/docs/n8n_logic_workerbee_alternatives.md`](n8n/docs/n8n_logic_workerbee_alternatives.md).

### Reading and writing

Everything the package does is read-only but one operation. `Comment: Reply`
signs a comment with a posting key and broadcasts it, which is why it arrives as
its own resource, its own credential (**Hive Posting Key**), and its own module.
A workflow that never publishes never has a key in reach.

The key is held in memory by an in-memory beekeeper wallet — wax cannot sign from
a raw WIF, it wants a wallet — and it never reaches a log line, an item or an
error message. Posting authority only: it can comment, vote and reblog, and it
cannot move funds or change keys.

On anything that is not mainnet, set the **Chain ID** on the Hive API credential.
A signature is computed over it, so a transaction signed without it is signed for
mainnet, and a testnet rejects it as `missing required posting authority` —
blaming a key that is perfectly good. Reads never notice, which is why the
mistake only surfaces on the first broadcast.

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

### CommonJS nodes, an ESM-only library

n8n `require()`s a compiled node, while `@hiveio/wax` and the WorkerBee build are
ESM-only. Three consequences, all of them deliberate:

- `tsconfig` uses `module: node16`, not `commonjs`, so a dynamic `import()` is
  emitted as an `import()` instead of being rewritten to `require()`. That import
  is how the CommonJS node reaches the ESM library — and it also means nothing
  WASM-shaped loads while n8n is merely scanning the nodes directory.
- wax types come through `nodes/shared/wax-types.ts`, which carries the
  `resolution-mode` import attribute once instead of at every import site.
- `../src` is bundled with esbuild into `workerbee/index.mjs`, because a plain
  `tsc` output keeps extensionless relative imports that Node's ESM loader
  refuses.

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
npm run build             # declarations from ../src, esbuild bundle, tsc, assets
npm test                  # build + node --test, no browser
```

Tests use `node --test` with fixture-based fakes and no mocking library. The
catalog tests compile every registry entry against a **real** `QueenBee` and
assert that the registry covers exactly the observers the library offers, so a
rename in `src/` fails there rather than in production.

---

## Publishing status

The package installs into any self-hosted n8n today. Getting *verified* by n8n is
a different bar, and it is not cleared yet: n8n Cloud allows community nodes no
runtime dependencies and forbids `setInterval`, which is what WorkerBee's block
poller runs on. The full requirement list, the local gate command and every rule
currently failing are in
[`n8n/docs/raport_n8n_deploy.md`](n8n/docs/raport_n8n_deploy.md).
