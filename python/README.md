# WorkerBee (Python)

Python port of [`@hiveio/workerbee`](https://www.npmjs.com/package/@hiveio/workerbee), a Hive blockchain automation library built on [hiveio-wax](https://gitlab.syncad.com/hive/wax).

WorkerBee provides an event-based observer pattern for bots that react to blockchain events such as posts, votes, transfers, account changes, market activity, and governance signals. It supports live streaming and historical replay.

## Requirements

- Python 3.12+
- [hiveio-wax](https://gitlab.syncad.com/hive/wax) 2.0.2.dev20260622105138 or newer

## Installation

```bash
pip install hiveio-workerbee
```

## Quick Start

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain
from workerbee import WorkerBee


async def main():
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        bot.observe.on_block().subscribe(on_next=lambda data: print(data["block"]["number"]))
        await bot.run_forever()


asyncio.run(main())
```

Use async iteration when the event handler needs to await work:

```python
from wax import WaxChainOptions, create_hive_chain
from workerbee import WorkerBee


async def watch_account(account: str) -> None:
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        async for event in bot.observe.on_impacted_accounts(account):
            impacted = event["impacted_accounts"][account]
            print(f"{account} was impacted by {len(impacted)} operation(s)")
```

## Architecture

```
Block Stream
    |
    v
+---------------+     +---------------+     +--------------+
|  Classifiers  | --> |  Collectors   | --> |  Factories   |
| (13 classes)  |     | (15 classes)  |     | (JsonRpc,    |
|               |     |               |     |  HistoryData)|
+---------------+     +---------------+     +--------------+
                                                   |
                                                   v
                                          +------------------+
                                          | ObserverMediator |
                                          +------------------+
                                            |             |
                                            v             v
                                      +---------+   +----------+
                                      | Filters |   | Providers|
                                      | (22)    |   | (22)     |
                                      +---------+   +----------+
                                            \           /
                                             v         v
                                          +-------------+
                                          |  QueenBee   |
                                          | (fluent API)|
                                          +-------------+
                                                |
                                                v
                                          +-------------+
                                          |  WorkerBee  |
                                          | (bot entry) |
                                          +-------------+
```

Pipeline: Classifiers declare required data, collectors fetch it, factories build the evaluation context, `ObserverMediator` coordinates filter matching and provider enrichment, and `QueenBee` delivers typed notifications to subscribers.

## API Reference

### WorkerBee

`WorkerBee` is the main bot class. It manages lifecycle, block streaming, transaction broadcast, and historical replay entry points.

```python
from datetime import timedelta

from workerbee import WorkerBee, __version__

print(__version__)


async def stream_blocks(chain) -> None:
    async with WorkerBee(chain) as bot:
        async for block in bot:
            print(block["number"], block["id"])


async def broadcast_transaction(bot: WorkerBee, transaction) -> None:
    await bot.broadcast(transaction, expire_in=timedelta(seconds=30), verify_signatures=True)


async def park_bot(bot: WorkerBee) -> None:
    await bot.run_forever()
```

Block iteration raises pipeline errors by default. To handle errors and keep iterating, pass a callback:

```python
async def stream_with_error_handler(bot: WorkerBee) -> None:
    async for block in bot.iterate(on_error=log_error):
        print(block["number"])
```

### QueenBee (`bot.observe`)

`QueenBee` is the fluent observer builder exposed through `bot.observe`. Each access returns a fresh builder, and a builder can be subscribed once.

Callbacks may be synchronous or `async def`:

```python
bot.observe.on_posts("alice", "bob").subscribe(
    on_next=lambda data: print(data["posts"]),
    on_error=lambda err: print(f"observer error: {err}"),
)

bot.observe.on_votes("alice").subscribe(on_next=handle_vote)

bot.observe.on_accounts_balance_change(True, "alice").subscribe(on_next=handle_balance)

bot.observe.on_posts("alice").and_.on_votes("alice").subscribe(on_next=handle)

bot.observe.on_whale_alert({"amount": 100000, "nai": "@@000000021", "precision": 3}).subscribe(on_next=handle)

bot.observe.on_alarm("alice").subscribe(on_next=handle_alarm)

bot.observe.on_exchange_transfer().subscribe(on_next=handle_exchange)

bot.observe.on_custom_operation("splinterlands").subscribe(on_next=handle_custom)
```

Observer chains are also async-iterable:

```python
async def consume_posts(bot: WorkerBee) -> None:
    async for event in bot.observe.on_posts("alice"):
        await handle_post(event)
```

The subscription closes when the iterator is finalized. For deterministic early shutdown, use callback subscriptions and `sub.close()`, or call `aclose()` on the async iterator object.

Available observer methods include:

`on_block`, `on_block_number`, `on_transaction_ids`, `on_impacted_accounts`, `on_accounts_balance_change`, `on_accounts_metadata_change`, `on_accounts_full_manabar`, `on_accounts_manabar_percent`, `on_new_account`, `on_alarm`, `on_custom_operation`, `on_posts`, `on_comments`, `on_votes`, `on_mention`, `on_reblog`, `on_follow`, `on_posts_incoming_payout`, `on_comments_incoming_payout`, `on_feed_price_change`, `on_feed_price_no_change`, `on_whale_alert`, `on_exchange_transfer`, `on_internal_market_operation`, and `on_witnesses_missed_blocks`.

Provider-only methods include:

`provide_accounts`, `provide_witnesses`, `provide_rc_accounts`, `provide_block_header_data`, `provide_block_data`, `provide_feed_price_data`, and `provide_manabar_data`.

### Typed Notifications

Subscriber callbacks receive an `ObserverNotification`, a `TypedDict(total=False)` exported from `workerbee`.

```python
from workerbee import ObserverNotification


def handle_event(event: ObserverNotification) -> None:
    accounts = event.get("accounts")
    if accounts is not None:
        print(accounts.keys())
```

Payload leaves that come directly from Hive APIs use canonical `hiveio_api`/`wax` models. WorkerBee-specific projections and grouping containers are typed in `workerbee.chain_observers.payloads`.

### PastQueen

`PastQueen` processes historical blocks and can transition to live observation after replay.

```python
from workerbee.chain_observers import PastQueen

past = PastQueen(bot, from_block=80000000, to_block=80000100)
past.on_posts("alice").subscribe(on_next=handle_historical_post)
```

`WorkerBee` exposes two replay entry points, split by whether a chain query is needed:

```python
def replay_range(bot) -> None:
    past = bot.provide_past_operations(80000000, 80000100)
    past.on_posts("alice").subscribe(on_next=handle_historical_post)


async def replay_recent(bot) -> None:
    past = await bot.provide_past_operations_relative("-1h")
    past.on_posts("alice").subscribe(on_next=handle_historical_post)
```

## Examples

See [examples/](examples/) for runnable scripts:

- `block_parser.py` - iterate over live blocks, print block id and number
- `account_observer.py` - monitor operations impacting an account
- `post_observer.py` - watch for new posts and sign votes when a private key is configured
- `custom_json_spotter.py` - print transactions from blocks containing `custom_json_operation`

Run an example:

```bash
python -m examples.block_parser --api-endpoint https://api.hive.blog/
```

## Development

Requires [Poetry](https://python-poetry.org/) 2.1.3+ with the `poetry-dynamic-versioning` plugin.

```bash
poetry install

poetry run pre-commit run --all-files --config ../.pre-commit-config.yaml

poetry run pytest tests/unit/test_import_time.py -q
poetry run pytest tests/unit -q -n auto
```

Integration tests run against the configured mirrornet endpoint:

```bash
WORKERBEE_MIRRORNET_ENDPOINT=https://api.hive.blog poetry run pytest tests/integration -q -n auto
poetry run pytest tests/mock -q
```

Agent/developer practices for the port live in [AGENTS.md](AGENTS.md).

## Relationship to TypeScript Codebase

This is a full port of the TypeScript [`@hiveio/workerbee`](https://www.npmjs.com/package/@hiveio/workerbee) library. It preserves:

- 4-layer architecture: Classifier -> Collector -> Factory -> ObserverMediator
- class names such as `WorkerBee`, `QueenBee`, `PastQueen`, and `ObserverMediator`
- filter/provider pairing logic
- fluent API composition with `and_` and `or_`

The TypeScript source under `../src/` is the behavioral source of truth. Python public names use `snake_case` for PEP 8 compliance, for example `onBlock()` becomes `on_block()` and `provideBlockData()` becomes `provide_block_data()`.

The Python port depends on `hiveio-wax` instead of the npm `@hiveio/wax` package.

## License

See repository root for license information.
