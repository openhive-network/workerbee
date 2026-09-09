# `@hiveio/n8n-nodes-hive`

Hive blockchain nodes for [n8n](https://n8n.io), running WorkerBee inside n8n.

There is no companion service. The trigger compiles what you pick in the editor
into a WorkerBee observer chain and subscribes to it in the n8n process, so a
block goes from the chain to your workflow with no HTTP hop in between.

```
   n8n editor                    this package                       Hive
  ┌─────────────┐   dropdowns   ┌──────────────────────┐
  │ Hive        │◄──────────────│ events.ts  catalog.ts│
  │ Hive Trigger│  spec builder │ spec.ts    compiler.ts│
  └─────────────┘               └──────────┬───────────┘
         ▲                                 │ QueenBee.on*/provide*
         │  one item per event             ▼
         └──────────── stream.ts ◄── WorkerBee ◄── one block stream per endpoint
```

Not one event name, parameter name or default is written into a form. They live
in [`nodes/shared/events.ts`](nodes/shared/events.ts), one entry per
`QueenBee.on*` / `provide*` call, and the dropdowns, the validation, the catalog
and the JSON Schema are all derived from that one table. Adding an observer is
one entry.

The library is not a published dependency: the build compiles it from
[`../src`](../src) and bundles it into the package, so the nodes and the
library in this checkout always agree about what an observer is called.

## Nodes

**Hive Trigger** — starts a workflow on chain events. Activating the workflow
subscribes; deactivating unsubscribes and, when it was the last subscriber on
that Hive node, stops polling it.

**Hive** — the request/response half:

| Resource | Operations |
|---|---|
| Chain | `Get Status` (head block), `Get Health` (which endpoints this n8n keeps open) |
| Account | `Get` |
| Block | `Get` |
| Catalog | `Get Events` (everything the trigger can watch), `Get Schema` (JSON Schema of the spec and of both item shapes) |
| Comment | `Reply` — **writes to the chain**: signs a reply with a posting key and broadcasts it |
| Spec | `Preview` (compile the visual builder into the JSON the trigger's Raw JSON field takes) |

### `Comment: Reply`

Parent Author, Parent Permlink and Body, plus two options. It returns
`transactionId`, `author`, `permlink`, `parentAuthor`, `parentPermlink` and the
`endpoint` it used.

**Permlink** is the one that matters. Left empty, the reply gets a permlink
derived from the parent and the clock, so a *retry publishes a second comment* —
and n8n's own "Retry on Fail" is exactly what would trigger that after a timeout
whose request actually succeeded. Supply a permlink and a retry lands on the same
comment, which the chain treats as an edit of an identical body: a no-op. Set it
for anything unattended.

**Title** is ignored by front ends; replies do not have one.

The node is exposed to AI agents as a tool for its *reads*. Publishing is refused
when it runs as one — the description says so, and `runOne` enforces it above the
credential read, because n8n's `usableAsTool.replacements` can only rewrite prose
and cannot restrict a single parameter.

## Composing what to watch

The spec is an AND of OR-groups, mirroring how `QueenBee` composes `and`/`or`:

| WorkerBee | Spec | This package |
|---|---|---|
| `QueenBee.on*` — filters | `match` | **Events**, one entry each |
| `QueenBee.provide*` — providers | `provide` | **Providers**, one entry each |
| collectors, classifiers | — | — |

Collectors and classifiers deliberately have no UI. They are internal machinery
WorkerBee selects from the filters and providers you pick; the library offers no
knob for them either, so inventing one here would be a lie.

The **Events** list is read top to bottom, and each entry says how it joins the
one above it — the same order, and the same two words, as the `QueenBee` chain it
produces. Consecutive **Or** entries form one group; an **And** closes that group
and opens the next. So

| Join With Previous | Event | Parameters |
|---|---|---|
| — | Posts | authors = `alice,bob` |
| Or | Votes | voters = `alice` |
| And | Impacted Accounts | accounts = `alice` |

means *(a post by alice or bob **or** a vote by alice) **and** an operation
impacting alice*. It is `.onPosts("alice", "bob").or.onVotes("alice").and.onImpactedAccounts("alice")`,
and it compiles to:

```json
{"match": [[{"event": "posts", "authors": ["alice", "bob"]},
            {"event": "votes",  "voters":  ["alice"]}],
           [{"event": "impacted_accounts", "accounts": ["alice"]}]]}
```

Values are typed by the catalog: `list[str]` splits on commas, `int`/`float`
parse, `bool` accepts `true/1/yes/on`, `int | str` keeps `-1h` as text but reads
`3600000` as a number, and object-valued parameters such as `whale_alert`'s
asset take JSON. A required parameter left out, or one that does not belong to
the chosen event, is refused when the workflow is saved — with the list of valid
names — rather than at the first matching block.

The first entry's join is ignored — it has nothing above it — and n8n cannot hide
a field conditionally inside a collection, so it stays visible. Each entry's
title shows its join (`OR posts`, `AND impacted_accounts`), which is how you read
the grouping without opening every row.

Why a per-entry join rather than group numbers, and what else n8n offers:
[`docs/n8n_logic_workerbee_alternatives.md`](docs/n8n_logic_workerbee_alternatives.md).

**Spec Mode: Raw JSON** takes the whole spec by hand for anything the form
cannot express.

## Emit modes

`Notification` gives one item per WorkerBee notification, carrying the merged
payload. `Operation` gives one item per individual operation, which is usually
what a workflow wants: an `IF` node then tests a single operation instead of an
array.

Every item carries the same envelope — `kind`, `subscriptionId`, `seq`,
`emittedAt`, `blockNum`, `blockId` — and `seq` increases by one per
subscription, so a gap tells you items were dropped.

An operation item carries four more fields:

| Field | What it holds |
|---|---|
| `group` | the notification key it came from: `votes`, `whaleOperations`, … |
| `account` | the tracked name it was grouped under, or `null` when the group is not keyed by an account |
| `key` | present only where the group is keyed by something else — for `customOperations`, the `custom_json` app id |
| `context` | every payload key that carries no operations: provider data, and the rest of `block`. Absent when there is none |

`context` is what makes providers usable in this mode. The exploded groups
become items; everything else — `accounts`, `feedPrice`, `manabarData`,
`block.witness` — would otherwise have nowhere to go, so it rides along on each
item. It is one shared object, not a copy per item.

Operation mode falls back to a single notification item when a notification has
nothing to explode: a bare `onBlock`, or a payload that is only provider state.
Emitting nothing would be indistinguishable from a dropped event.

## What the payload looks like

Chain data is normalised on the way out, because the raw shapes are hostile to
an n8n expression:

| Raw | Emitted | Why |
|---|---|---|
| `WorkerBeeIterable` | array | `JSON.stringify` turns it into `{"iterable":[…]}`, so `$json.votes.alice[0]` finds nothing |
| `manabarData[alice][2]` | `manabarData.alice.RC` | an ordinal is unreadable and changes meaning if the enum is reordered |
| `alarmsPerAccount.alice = [3]` | `["RECOVERY_ACCOUNT_IS_CHANGING"]` | same |
| an integer past 2⁵³ | a string | n8n evaluates expressions in JavaScript, which would round it silently |
| `Date` | ISO-8601 | comparable and human-readable |
| `undefined` | omitted | so an `IF` can test key presence |

Keys are WorkerBee's own (`impactedAccounts`, `whaleOperations`, `manabarData`),
so anything the library documents about a provider holds for the item too.

## Back-pressure

A workflow slower than the chain cannot slow the chain down. Items queue up to
**Max Queue** (default 500) and then **Overflow** applies — `Drop Oldest` keeps
the freshest chain state, `Drop Newest` keeps the oldest backlog. Drops are
counted and logged with the node name, so the failure mode is visible rather
than an ever-growing heap.

## Credentials

Two, and the split between them is the point.

**Hive API** — optional: the API endpoint, and a chain ID for anything that is
not Hive mainnet. No keys, no secrets. Every operation except one only reads, and
those calls are unsigned.

> **The chain ID only matters when something is signed**, which is why leaving it
> out costs nothing until the first `Comment: Reply` — and then fails as
> `missing required posting authority`, blaming a key that is perfectly good. A
> signature is computed over the chain ID; omitted, wax uses mainnet's, and a
> testnet cannot match it. Set it for a testnet or mirrornet, leave it empty for
> mainnet.

Leave it off entirely and the nodes use `https://api.hive.blog/`. Set it to
point a whole instance at a private node or a testnet, and override it per
subscription under **Spec Options → Hive API Endpoint** or per call on the
action node.

**Hive Posting Key** — an account name and its private posting key, asked for
only by `Comment: Reply`, the one operation that writes. A workflow that never
publishes never attaches it, and never has a secret in reach.

> **Posting authority only.** A posting key can comment, vote and reblog; it
> cannot move funds, change keys, or touch the account itself. Nothing here needs
> an active or owner key, and n8n's credential store is not the place for one.
>
> The key is held in memory by an in-memory beekeeper wallet — nothing is written
> to disk — and it is never logged, never attached to an error, and never
> returned in an item. The cache that keeps the unlocked wallet is keyed by a
> digest of the key, not by the key itself.
>
> There is no Test button on this credential. n8n's declarative credential test
> can only interpolate fields of *this* credential, which holds no endpoint, so
> it would have to hardcode `api.hive.blog` — wrong for exactly the testnet users
> the Chain ID field exists for. A wrong key fails on the first reply, as a
> credential error rather than as an endpoint failure.

One block stream is shared per endpoint across the whole n8n process, so fifty
workflows watching Hive cost one poller, not fifty.

## Running it

```bash
cd n8n
docker compose up -d --build
```

Open <http://localhost:5678>; **Hive** and **Hive Trigger** are in the node
panel. `docker compose logs n8n | grep hiveio` shows the load:

```
Installing @hiveio/n8n-nodes-hive 0.2.0 (build 3f9c1a...) into /home/node/.n8n/nodes; previous build: none
Loaded all credentials and nodes from @hiveio/n8n-nodes-hive {"credentials":2,"nodes":2}
```

[`workflows/`](workflows) holds six importable examples: live blocks, account
activity in operation mode, an on-demand account lookup, and three that end
somewhere other than the canvas — see below.

What each one is for, what it needs, and the traps it exists to demonstrate:
[`workflows/README.md`](workflows/README.md) — which also carries the `curl` for
reading a whole comment thread back off the chain.

Import them one at a time from the editor (**⋯ → Import from File**), or the
whole directory in one command:

```bash
docker compose cp workflows n8n:/tmp/workflows
docker compose exec n8n n8n import:workflow --separate --input=/tmp/workflows/
```

Every file carries a stable `id`, which is what the CLI needs; the editor does
not. They import **inactive** — publish the ones you want from the editor, since
n8n 2.x activates from a published version and not from the `--active` flag.
Credentials are referenced by name, never included: import or create those first
and the references resolve, otherwise open each node and pick one.

### The Postgres example

[`workflows/gtg-busy-blocks.json`](workflows/gtg-busy-blocks.json) watches every
Hive block, keeps the ones `gtg` produced, keeps those with more than five
transactions, and writes one row per transaction to Postgres. It is built from
stock n8n nodes only — If, If, Split Out, Postgres — so there is no Code node to
read: the whole thing is visible on the canvas.

`docker compose up -d` starts the database alongside n8n and creates the table
from [`docker/postgres-init.sql`](docker/postgres-init.sql). Then, in the editor:

1. **Import** the file (⋯ menu → Import from File).
2. **Create the credential** the Postgres node asks for — type *Postgres*, host
   `postgres`, database/user/password `hive` (or whatever you put in `.env`).
3. **Activate** the workflow.

`gtg` produces roughly one block a minute, so the first rows take a couple of
minutes:

```bash
docker compose exec postgres psql -U hive -d hive \
  -c 'SELECT block_num, count(*) FROM block_transactions GROUP BY 1 ORDER BY 1 DESC LIMIT 5;'
```

The primary key is `(block_num, transaction_id)`, so re-activating the workflow
while the same block is in flight conflicts instead of duplicating.

Two things about it are worth knowing before you copy the shape:

- **Split Out needs the field named.** It spreads an object element straight into
  the item only when it carries nothing else along. This one also carries
  `blockNum`, so the element gets a name of its own (`tx`) and the insert reads
  `{{ $json.tx.id }}`. Without that the element lands under the literal key
  `payload.block.transactions` and the insert silently has nothing to write.
- **Successful executions are not saved.** A block every three seconds is roughly
  29,000 executions a day, and about 99% of them stop at the first If. The record
  of what happened is the table; keeping the no-ops would grow n8n's own database
  for no information. Failures *are* saved. Both are one setting in the workflow's
  settings panel if you want the successes back while you are learning.

### The Ollama + Discord example

[`workflows/short-comments-to-discord.json`](workflows/short-comments-to-discord.json)
watches every block, picks out comments shorter than 500 characters, asks a local
Ollama to summarise each one, and posts the summary to a Discord webhook. Stock
nodes only: Split Out, Split Out, Filter, Ollama, Discord.

Two credentials, neither of them in this file:

- **Ollama** (type *Ollama*) — the base URL of your Ollama. From inside a
  container that is not `localhost`: either put n8n on Ollama's Docker network
  and use `http://ollama:11434`, or use the host's own address.
- **Discord** (type *Discord Webhook*) — the webhook URL. It is a secret: anyone
  holding it can post to the channel, which is why the workflow references a
  credential rather than carrying the URL.

Three things this example exists to show:

- **"Model is required" while the model is filled in.** The Ollama node's Model
  field is a *resource locator*: the selector beside it chooses between picking
  from a list and giving an ID. Typing the name while it is still set to *From
  list* leaves the stored value empty, and the node reports the field as missing.
  Switch the selector to *By ID* — the workflow does this with
  `"mode": "id", "value": "llama3.1:8b"`.
- **There is no "all comments" event**, and that is why this one still takes
  blocks apart while the Claude example does not. WorkerBee's `comments` and
  `impacted_accounts` observers are both account-scoped, so watching *everyone*
  leaves only the block stream. Emit Mode: Operation does not help here either —
  it explodes the notification keys that carry operations, and a block payload is
  not one of them, so it falls back to a single item per block. Scope it to a
  list of authors and both of those change; watch everyone and this is the shape.
  A non-empty `parent_author` is what separates a reply from a top-level post —
  the same operation carries both.
- **The Ollama node returns only `{ content }`.** The comment it summarised is
  gone from the item, so the Discord message reaches back for the author and the
  block number through `$('Short comments only').item`.

### The Claude example, and what it cannot do

[`workflows/watched-post-replies.json`](workflows/watched-post-replies.json)
follows one post — an author and a permlink set in the *Watched post* node —
picks out replies to it, and has Claude write the answer: thanks and a light
joke for a positive reply, an apology and a concrete promise for a negative one,
thanks for the opinion when it is neutral.

Needs an **Anthropic** credential (your API key) in the *Write the reply* node.
The model is set as `claude-opus-5` through the resource locator's *By ID* mode,
for the same reason as the Ollama example.

It ends by publishing: the last node is `Comment: Reply` on the Hive node, which
signs the answer with the **Hive Posting Key** credential and broadcasts it.

> **A published comment cannot be edited or deleted.** Nothing in this workflow
> asks for confirmation, and the model's output goes on-chain verbatim — which is
> why its prompt forbids any label or preamble, and why the answer is capped at a
> few sentences. Point it at a post you own and run it with the workflow
> deactivated (**Test step**) before you let it run by itself.

Five notes on the shape:

- **It waits on the author, not on blocks.** Hive counts a comment's
  `parent_author` among the accounts the operation impacts, so
  `impacted_accounts` on the post's author wakes the workflow the moment someone
  replies. An earlier version watched every block and threw ~99% of the runs
  away; this one runs when something actually happens. With **Emit Mode:
  Operation** the trigger hands over one already-unpacked operation per item, so
  the two Split Out nodes that used to take a block apart are gone.
- **It answers the reply, not the post.** The parent of what it publishes is
  whoever just wrote and their permlink — so the answer hangs off the comment,
  where a reader expects it. That also settles the loop question for free: the
  bot's own comment has the incoming reply as its parent, never the watched post,
  so the permlink check above already excludes it. Verified on chain.
- **It still declines to talk to itself.** The second filter condition drops a
  comment whose author is the account being watched. Not loop protection — the
  permlink check does that — but it stops the bot answering a comment its own
  account wrote directly under the post.
- **`parent_permlink` still has to match.** `impacted_accounts` fires for replies
  to *any* post that author wrote, and for votes, transfers and follows besides.
  The permlink check narrows it to the one post — and doubles as "is this a
  comment at all", since anything else yields an empty string.
- **The three tones live in the prompt, not on the canvas.** One Claude call
  classifies and writes. Splitting them into three visible branches costs a
  Switch, three Set nodes and a Merge — six nodes to express what is one
  paragraph of prompt — so this example keeps the prompt. Split it if you would
  rather tune the three answers by clicking than by editing text.

After a change to anything under `n8n/` or `src/`, `docker compose up -d --build`
again — the dependency layer is cached, so it is a TypeScript compile and a copy.

### Installing into an existing n8n

```bash
cd n8n && npm ci --ignore-scripts && npm run build && npm pack
cd ~/.n8n/nodes && npm install /path/to/hiveio-n8n-nodes-hive-0.2.0.tgz
```

Restart n8n. `~/.n8n/nodes` is where n8n installs a community node from its own
UI, so the package is discovered the ordinary way.

> A bind mount of `dist/` into `N8N_CUSTOM_EXTENSIONS` — which an earlier version
> of this package documented — no longer works, for two reasons. The nodes now
> have a runtime dependency graph that has to resolve from a real `node_modules`,
> and `CustomDirectoryLoader` globs `**/*.node.js`, which matches
> `@hiveio/wax`'s own `build_wasm/wax.node.js` and then fails trying to load it
> as an n8n node.

## Development

```bash
npm ci             # --ignore-scripts is fine; isolated-vm is only pulled in for types
npm run build      # declarations from ../src, esbuild bundle, tsc, assets
npm run typecheck
npm test           # build, then node --test
```

`npm test` runs the unit tests with Node's own runner — no browser, so it does not
share the library's Playwright setup. The interesting ones compile every catalog
entry against a **real** `QueenBee` and assert that the registry covers exactly
the observers the library offers, so a rename in `../src` fails the build here
instead of shipping a node that throws.

For an end-to-end check against a live Hive node, through fake n8n execution
contexts:

```bash
docker exec -i <container> node - < dev/smoke.cjs
```

## How this package is put together

Three constraints shape the build, and all three come from the same place: n8n
loads nodes as **CommonJS**, while `@hiveio/wax` and the WorkerBee build that
wraps it are **ESM-only**.

1. **The nodes are CommonJS and reach ESM through `await import()`.**
   `tsconfig.json` uses `module: node16` rather than plain `commonjs`, because
   that is what stops TypeScript rewriting a dynamic `import()` into a
   `require()`. The specifiers live in variables so they survive compilation
   verbatim. Nothing WASM-shaped is loaded while n8n is merely scanning the
   nodes directory.
2. **wax types come through `nodes/shared/wax-types.ts`.** Its `exports` map has
   no `require` condition, so a plain type import from a CommonJS file does not
   resolve; the `resolution-mode` attribute is spelled out once there instead of
   at every import site.
3. **`../src` is bundled, not compiled in place.** The library's sources use
   extensionless relative imports, which Node's ESM loader rejects. Its own
   release build solves that with rollup; `scripts/bundle-workerbee.mjs` solves
   it with esbuild — one dependency instead of five, and wax stays external so
   its WebAssembly keeps loading from its own package directory.

There are two runtime dependencies, `@hiveio/wax` and `@hiveio/beekeeper`. That rules the package out of n8n's
*verified* community-node programme, which allows none — the previous
bridge-backed design had none precisely because of that rule. Running WorkerBee
in the process is what buys the absence of a second service, and it is not
compatible with that rule; the package is installable and works, it just is not
a candidate for verification.

## Trade-offs worth knowing

**The subscription lives with the n8n instance.** It is recreated on restart like
any other trigger, but nothing is buffered while n8n is down. For a gap-free
feed, pair the trigger with `Hive: Get Block` over the missed range.

**Regular execution mode.** A trigger holding a live subscription runs on the
main instance, so this needs `EXECUTIONS_MODE=regular` (the compose file sets
it). The previous webhook-based design worked in queue mode; that went away with
the service that provided the webhooks.

## Why this lives at the repository root, not under `packages/`

`pnpm-workspace.yaml` is a symlink into the shared `npm-common-config`
submodule, and its globs cover `./packages/**/*`. Putting an npm-built,
CommonJS, separately released package there would either drag its
`n8n-workflow` devDependency into every `pnpm install` of the library, or force
an edit to a config file other Hive projects share. A top-level directory avoids
both.

## Publishing

Package name, `keywords`, the `n8n` key and the MIT licence already follow the
community-node rules, so publishing to npm and installing on a self-hosted n8n
needs nothing more.

Getting *verified* — reviewed by n8n, installable on n8n Cloud, listed in the
nodes panel — is a different bar, and this package does not clear it yet. The
gate can be run locally, and what it currently reports, down to the individual
rule, is in [`docs/raport_n8n_deploy.md`](docs/raport_n8n_deploy.md). Most of
what it lists is minutes of work; one item is not — n8n Cloud allows community
nodes no runtime dependencies, and this package has two, both WebAssembly, and
forbids the `setInterval` its block poller runs on.
