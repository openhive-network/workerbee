# WorkerBee Python User Guide

WorkerBee is a Hive blockchain automation library. It lets a Python program describe the chain activity it cares about, then receive typed event payloads through callbacks or async iteration.

The Python package is a port of the TypeScript `@hiveio/workerbee` library. The TypeScript codebase is the behavioral source of truth, but Python public APIs use Python conventions such as `snake_case`, `async with`, and callbacks passed as keyword arguments.

## Installation

Install the package into a Python 3.12+ environment:

```bash
pip install hiveio-workerbee
```

Development builds are published in the Hive GitLab package registry. If the
package is not available from the configured index, install with that registry
enabled:

```bash
pip install --extra-index-url https://gitlab.syncad.com/api/v4/groups/136/-/packages/pypi/simple hiveio-workerbee
```

The examples below use the public Hive endpoint `https://api.hive.blog/`. They are bounded with timeouts or fixed replay ranges so they can be run as scripts.

## The User-Facing Model

Start with a `wax` chain connection, then pass that chain into `WorkerBee`. The bot starts polling when it enters its async context manager and stops when the context exits. If WorkerBee creates an extended chain wrapper internally, `aclose()` also closes that wrapper.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain
from workerbee import WorkerBee


async def main() -> None:
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        async with asyncio.timeout(20):
            block = await anext(aiter(bot))
        print(f"block {block['number']} {block['id'][:12]}")


asyncio.run(main())
```

In a long-running bot, register one or more observers inside the context and keep the process alive with `await bot.run_forever()`. For short scripts, wait for a bounded condition and let the async context tear the bot down.

## Observe Builder

`bot.observe` returns a fresh `QueenBee` builder every time it is accessed. Add filters with methods such as `on_block()`, `on_impacted_accounts()`, `on_posts()`, `on_votes()`, and `on_custom_operation()`. Add extra payload data with provider methods such as `provide_accounts()`, `provide_block_data()`, and `provide_feed_price_data()`.

A builder is single-use: call `subscribe()` once, or iterate it once. For another subscription, start again from `bot.observe`.

Filters in the same group are ORed. Calling `and_` starts a new group, and committed groups are ANDed together. `or_` is available as an explicit marker, but staying in the same group already means OR.

Provider-only methods do not decide whether an event matches. They add data to the notification when the filter chain matches.

## Callback Subscriptions

Use `subscribe()` when callback-style code is the clearest fit or when you want an explicit `Subscription` handle. `on_next`, `on_error`, and `on_complete` can be regular functions or `async def` functions.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain
from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        done = asyncio.Event()

        def on_next(event: ObserverNotification) -> None:
            block = event["block"]
            print(f"callback saw block {block['number']}")
            done.set()

        def on_error(error: BaseException) -> None:
            print(f"observer error: {error}")
            done.set()

        sub = bot.observe.on_block().subscribe(on_next=on_next, on_error=on_error)
        try:
            await asyncio.wait_for(done.wait(), timeout=20)
        finally:
            sub.close()


asyncio.run(main())
```

Close callback subscriptions when a short-lived script is done with them. `sub.close()` is idempotent. You can also use a subscription as a synchronous context manager.

## Async Iteration

Use async iteration when event handling naturally needs `await`, backpressure, or a local loop. Observer chains are async-iterable. The default iterator queue is unbounded for compatibility; use `iterate(max_queue_size=...)` when a bounded queue is better.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain
from workerbee import WorkerBee


async def main() -> None:
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        events = bot.observe.on_block().iterate(max_queue_size=1)
        try:
            async with asyncio.timeout(20):
                event = await anext(events)
            block = event["block"]
            print(f"iterator saw block {block['number']}")
        finally:
            await events.aclose()


asyncio.run(main())
```

Pipeline errors raise out of observer async iterators. For deterministic early shutdown, keep the iterator object and call `await events.aclose()` in a `finally` block, as shown above.

## Payloads And Types

Subscriber callbacks receive an `ObserverNotification`. It is a `TypedDict(total=False)`: every key is optional because the keys depend on the filters and providers in the observer chain.

WorkerBee-local payload containers use dictionaries with `snake_case` keys, for example `impacted_accounts`, `new_accounts`, `whale_operations`, and `transactions_per_id`. Chain entities from `hiveio_api` and `wax` keep their model shape. Operation envelopes use attributes such as `op.type` and `op.value`, not dictionary subscription.

Prefer `ObserverNotification` for callback parameters. It keeps editor
completion focused on WorkerBee payload keys:

```python
from workerbee import ObserverNotification


def handle(event: ObserverNotification) -> None:
    impacted = event.get("impacted_accounts")
    if impacted is None:
        return
    for pair in impacted.get("alice", []):
        print(pair["operation"].type)
```

This example adds account data to every block notification:

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain
from workerbee import WorkerBee


async def main() -> None:
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        events = bot.observe.on_block().provide_accounts("initminer").iterate(max_queue_size=1)
        try:
            async with asyncio.timeout(20):
                event = await anext(events)
            account = event["accounts"]["initminer"]
            if account is None:
                print("initminer account was not returned")
                return
            balance = account["balance"]["HIVE"]["liquid"]
            print(f"initminer liquid HIVE: {balance}")
        finally:
            await events.aclose()


asyncio.run(main())
```

For code that wants runtime narrowing before indexing a payload key, use `has_payload()` with a payload fragment type:

```python
from datetime import UTC, datetime

from workerbee import ObserverNotification
from workerbee.chain_observers.payloads import BlockHeaderPayload, has_payload


def handle_block(event: ObserverNotification) -> None:
    if not has_payload(event, BlockHeaderPayload):
        print("notification did not include block data")
        return

    block = event["block"]
    print(f"block {block['number']} from {block['witness']}")


sample_event: ObserverNotification = {
    "block": {
        "id": "0000002a00000000000000000000000000000000",
        "number": 42,
        "timestamp": datetime(2026, 7, 6, tzinfo=UTC),
        "witness": "initminer",
    }
}

handle_block(sample_event)
```

## Historical Replay

`WorkerBee.provide_past_operations(from_block, to_block)` returns a `PastQueen` builder for an inclusive block range. It is synchronous because the range is already known. `provide_past_operations_relative(relative_time)` is async because it queries chain state to resolve the range.

Historical replay uses the same observer style, but live-only methods such as account balance changes, feed price checks, RC account data, witness data, and manabar data are not available on `PastQueen`.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain
from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        done = asyncio.Event()
        blocks: list[int] = []

        def on_next(event: ObserverNotification) -> None:
            block = event["block"]
            blocks.append(block["number"])
            print(f"replayed block {block['number']}")

        def on_error(error: BaseException) -> None:
            print(f"replay error: {error}")
            done.set()

        def on_complete() -> None:
            print(f"replay complete: {blocks}")
            done.set()

        bot.provide_past_operations(96_549_390, 96_549_392).on_block().subscribe(
            on_next=on_next,
            on_error=on_error,
            on_complete=on_complete,
        )
        await asyncio.wait_for(done.wait(), timeout=30)


asyncio.run(main())
```

## Error Handling Basics

Callback subscriptions route pipeline errors to `on_error` when you provide it. Without an error callback, listener pipeline errors are surfaced through the event loop exception handler.

Observer async iterators raise pipeline errors from the iterator. Wrap the `anext()` or `async for` in `try`/`except` when the script should recover or log a clean message.

Block iteration has a separate helper: `bot.iterate(on_error=...)` handles block pipeline errors with a callback and keeps iterating. Plain `async for block in bot` raises pipeline errors by default.

For application-level time limits, use normal asyncio tools such as `asyncio.timeout()` or `asyncio.wait_for()`. These timeouts are separate from WorkerBee pipeline errors.

## Application Integration Boundaries

WorkerBee covers live observation, bounded historical replay, and broadcasting a
signed transaction until it is seen on chain. It does not replace every Hive API.
Applications that need a startup backlog such as recent posts/comments with
`active_votes` should query Bridge directly, for example
`bridge.get_account_posts`, then use WorkerBee for new live notifications.

WorkerBee does not manage private keys or wallets. Use Wax/Beekeeper to build
and sign transactions, then pass the signed transaction to `await
bot.broadcast(tx)`. If the application imports `beekeepy` directly, declare
`hiveio-beekeepy` as an application dependency even though Wax currently pulls
it transitively.

`WorkerBee.broadcast(tx)` returns `None` after the transaction has been seen on
chain. Read `str(tx.id)` from the transaction object before or after the call if
the application needs a transaction id for logs or storage.

Vote operation weights come from the Hive/Wax operation schema and are basis
points, not percentages. Use `10_000` for a 100% upvote and `1_000` for a 10%
upvote. If application configuration stores a percentage, convert it with
`weight=vote_weight_percent * 100`.

`on_accounts_full_manabar(...)` mirrors TypeScript WorkerBee and is shorthand
for `on_accounts_manabar_percent(..., 98, ...)`. Applications that need a
stricter threshold should call `on_accounts_manabar_percent(...)` directly, for
example with `99.98`.

## Open Questions

- Automatic continuation of the same historical subscription into live observation is not part of the current Python contract. Use a bounded replay subscription first, then create a separate live subscription from `bot.observe` on the same `WorkerBee`.
- The TypeScript high-level README uses an `onPostsWithTags` example. No matching `QueenBee` method was present in the inspected Python public API, so tag filtering is not documented here.
