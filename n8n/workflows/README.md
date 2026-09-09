# Example workflows

Six importable examples, from "show me a block" to a bot that answers replies
on-chain. Every file carries a stable `id`, so the whole directory imports in one
command:

```bash
docker compose cp workflows n8n:/tmp/workflows
docker compose exec n8n n8n import:workflow --separate --input=/tmp/workflows/
```

The editor imports one at a time instead: **⋯ → Import from File**.

They arrive **inactive**. Publish the ones you want from the editor — n8n 2.x
activates a published version, and the CLI's `--active` flag sets a legacy column
that no longer does anything.

## What each one is

| File | Watches | Ends at | Needs |
|---|---|---|---|
| [`hive-live-blocks.json`](hive-live-blocks.json) | every block | a No-Op, for looking at the payload | — |
| [`hive-account-activity.json`](hive-account-activity.json) | one account, in operation mode | a No-Op | — |
| [`hive-fetch-account.json`](hive-fetch-account.json) | nothing — manual trigger | one account lookup | — |
| [`gtg-busy-blocks.json`](gtg-busy-blocks.json) | every block | Postgres | Postgres credential |
| [`short-comments-to-discord.json`](short-comments-to-discord.json) | every block | a Discord webhook | Ollama + Discord credentials |
| [`watched-post-replies.json`](watched-post-replies.json) | one post's author | **the chain** — it publishes | Anthropic + Hive API + Hive Posting Key |

The first three are for reading the shape of things. The last three do something
with it, and the notes on their nodes carry the reasoning — including the traps
that cost the most time.

## Credentials

Nodes reference credentials by id **and** name; the ids come from the instance
these were exported from, so on a fresh n8n the names are what match. If a node
shows a red credential warning, open it and pick your own — nothing here carries
a secret, only a reference.

`watched-post-replies` references one called *Skeleton key*, which is what it was
tested with on a mirrornet. **Do not point a mainnet posting key at an example.**

## The three that do something

### `gtg-busy-blocks` → Postgres

Keeps blocks produced by `gtg` that hold more than five transactions, and writes
one row per transaction. Stock nodes only: If, If, Split Out, Postgres.

Watch out for **Split Out**: it spreads an object element into the item only when
it carries nothing else along. This one also carries `blockNum`, so the element
is named (`tx`) and the insert reads `{{ $json.tx.id }}`.

### `short-comments-to-discord` → Ollama → Discord

Every comment shorter than 500 characters gets summarised by a local Ollama and
posted to a Discord webhook.

This is the one that still takes blocks apart, and deliberately: it watches
*everyone*, and both account-scoped observers (`comments`, `impacted_accounts`)
need a list of accounts. Emit Mode: Operation does not help either — it explodes
the notification keys that carry operations, and a block payload is not one.

**"Model is required" while the model is filled in** is the trap here: the Ollama
node's Model field is a resource locator, and typing a name while the selector
says *From list* stores nothing.

### `watched-post-replies` → Claude → the chain

Follows one post. When somebody replies to it, Claude writes an answer — thanks
and a light joke if the reply was positive, an apology and a concrete promise if
it was negative, thanks for the opinion if neutral — and the Hive node signs and
publishes it under that reply.

Set the post in two places: the author in the trigger's `accounts`, the permlink
in the **Watched post** node.

Four things worth knowing before running it:

- **It waits on the author, not on blocks.** Hive counts a comment's
  `parent_author` among the accounts it impacts, so the workflow wakes when
  somebody replies instead of ~28,800 times a day.
- **The Anthropic node returns `content` as an array of blocks**, not the string
  the Ollama node gives, and on a thinking model the first block is a thinking
  block with no text. The publish node joins the text blocks; passing the array
  straight through fails inside WebAssembly with "Cannot pass non-string to
  std::string", which tells you nothing about why.
- **On a testnet, set the Chain ID** on the Hive API credential. A signature is
  computed over it; without it the transaction is signed for mainnet and the node
  rejects a perfectly good key as `missing required posting authority`.
- **Deactivate before re-activating.** Activating an already-active workflow can
  leave the old subscription running, and then every reply is answered twice.
  Two `watching` lines and no `stopped` in the logs is the tell.

#### Reading the thread it produced

```bash
curl -s https://api.hive.blog \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"bridge.get_discussion","params":{"author":"AUTHOR","permlink":"PERMLINK"},"id":1}' \
| jq -r --arg root "AUTHOR/PERMLINK" '
    .result as $t
    | def ind($d): if $d == 0 then "" else "    " * $d end;
      def walk($k; $d):
        $t[$k] as $c
        | ind($d) + "@" + $c.author + "  ·  " + ($c.created // ""),
          ind($d) + ($c.body | gsub("\n"; " ")),
          "",
          ($c.replies[]? | walk(.; $d + 1));
      walk($root; 0)'
```

Substitute `AUTHOR` and `PERMLINK` in **both** places — the `params` and the
`--arg root` — or the walk starts at a key that is not in the result. Indentation
is nesting, so the bot's answers appear under the comments they answer. Drop the
`jq` half for raw JSON, and point `curl` at your own node (a testnet, for
instance) by changing the URL.
