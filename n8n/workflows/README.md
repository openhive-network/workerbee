# Example workflows

Five importable examples, from "show me a block" to a Discord digest. Every file
carries a stable `id`, so the whole directory imports in one command:

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

The first three are for reading the shape of things. The last two do something
with it, and the notes on their nodes carry the reasoning — including the traps
that cost the most time.

The bot answering replies on-chain (`watched-post-replies.json`) is gone with
`Comment: Reply` and `impacted_accounts`: the nodes are read-only now, so the
package carries no WebAssembly.

## Credentials

Nodes reference credentials by id **and** name; the ids come from the instance
these were exported from, so on a fresh n8n the names are what match. If a node
shows a red credential warning, open it and pick your own — nothing here carries
a secret, only a reference.

## The two that do something

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
*everyone*, and the account-scoped observer (`comments`) needs a list of
accounts. Emit Mode: Operation does not help either — it explodes
the notification keys that carry operations, and a block payload is not one.

**"Model is required" while the model is filled in** is the trap here: the Ollama
node's Model field is a resource locator, and typing a name while the selector
says *From list* stores nothing.
