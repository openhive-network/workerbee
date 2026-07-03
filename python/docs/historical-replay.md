# Historical Replay

Historical replay lets a `WorkerBee` observer process past Hive blocks with the same fluent observer style used for live blocks. In Python the entry points are:

- `bot.provide_past_operations(from_block, to_block)`: synchronous; creates a `PastQueen` for an inclusive block range.
- `await bot.provide_past_operations_relative(relative_time)`: asynchronous; queries the chain head first, resolves a relative start block, and creates an open-ended `PastQueen`.

Both methods return `PastQueen`, a historical observer builder. A `PastQueen` starts work only after `.subscribe(...)` is called, and subscription must happen while an asyncio event loop is running.

## Block Ranges

`provide_past_operations(from_block, to_block)` is the bounded form and is the safest default for scripts and documentation examples. The range is closed and inclusive: `from_block=96_549_390, to_block=96_549_392` emits blocks `96_549_390`, `96_549_391`, and `96_549_392` when observed with `.on_block()`.

Use small ranges when testing. Historical blocks are fetched from the configured chain endpoint in batches of up to 1,000 blocks, so large ranges can run for a long time and can put avoidable load on the endpoint. Invalid negative or future ranges are reported through the subscription error callback after replay starts. A range where `from_block > to_block` raises `WorkerBeeError` while creating the `PastQueen`.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain

from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    from_block = 96_549_390
    to_block = 96_549_392
    seen_blocks: list[int] = []
    errors: list[BaseException] = []
    finished = asyncio.Event()

    def on_next(event: ObserverNotification) -> None:
        seen_blocks.append(event["block"]["number"])

    def on_error(error: BaseException) -> None:
        errors.append(error)
        finished.set()

    def on_complete() -> None:
        finished.set()

    async with create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain:
        bot = WorkerBee(chain)
        subscription = bot.provide_past_operations(from_block, to_block).on_block().subscribe(
            on_next=on_next,
            on_error=on_error,
            on_complete=on_complete,
        )
        try:
            async with asyncio.timeout(45):
                await finished.wait()
            if errors:
                raise errors[0]
        finally:
            subscription.close()
            await bot.aclose()

    print(seen_blocks)


asyncio.run(main())
```

## Filtering Replayed Operations

Operation-based filters such as posts, votes, impacted accounts, transaction ids, custom operations, and block filters can be used on `PastQueen`. The payload shape is the same observer notification mapping used by live observers.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain

from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    posts: list[str] = []
    errors: list[BaseException] = []
    finished = asyncio.Event()

    def on_next(event: ObserverNotification) -> None:
        for entries in event.get("posts", {}).values():
            for item in entries:
                operation = item["operation"]
                posts.append(f"{operation['author']}:{operation['permlink']}")

    def on_error(error: BaseException) -> None:
        errors.append(error)
        finished.set()

    def on_complete() -> None:
        finished.set()

    async with create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain:
        bot = WorkerBee(chain)
        subscription = (
            bot.provide_past_operations(96_549_390, 96_549_415)
            .on_posts("mtyszczak", "nickdongsik")
            .subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)
        )
        try:
            async with asyncio.timeout(45):
                await finished.wait()
            if errors:
                raise errors[0]
        finally:
            subscription.close()
            await bot.aclose()

    print(posts)


asyncio.run(main())
```

## Relative Replay

`provide_past_operations_relative(relative_time)` is async because it calls `database_api.get_dynamic_global_properties()` to read the current head block and head time. Relative strings are negative offsets with units `s`, `m`, `h`, or `d`, for example `"-30s"`, `"-15m"`, `"-2h"`, or `"-1d"`.

The returned `PastQueen` has `to_block=None`. It starts at the resolved block and keeps replaying until the historical stream is exhausted or the subscription is closed. For bounded scripts, close the subscription yourself after the event you need, or prefer an explicit block range.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain

from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    seen: list[int] = []
    errors: list[BaseException] = []
    first_event = asyncio.Event()

    def on_next(event: ObserverNotification) -> None:
        seen.append(event["block"]["number"])
        first_event.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        first_event.set()

    async with create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain:
        bot = WorkerBee(chain)
        replay = await bot.provide_past_operations_relative("-30s")
        subscription = replay.on_block().subscribe(on_next=on_next, on_error=on_error)
        try:
            async with asyncio.timeout(60):
                await first_event.wait()
            if errors:
                raise errors[0]
        finally:
            subscription.close()
            await bot.aclose()

    print(seen[:1])


asyncio.run(main())
```

## Subscription Lifecycle

Calling `.subscribe(...)` commits one fluent observer chain. The returned `Subscription` is the lifecycle handle. Call `subscription.close()` when you want to stop early; it is idempotent and can be called even after natural completion.

Callbacks are passed as keyword arguments:

- `on_next(event: ObserverNotification)`: called for each matching replay notification.
- `on_error(error)`: called for replay collection, filtering, or provider failures when supplied.
- `on_complete()`: called when the listener is unregistered. For historical replay, that includes natural replay exhaustion and explicit `subscription.close()`.

Callbacks may be regular functions or `async def` functions. During natural replay completion, pending notifications for the last replayed block are drained before `on_complete` runs. During synchronous `subscription.close()`, async `on_complete` callbacks are scheduled best-effort because `close()` itself is not awaitable.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain

from workerbee import ObserverNotification, WorkerBee


async def main() -> None:
    rows: list[str] = []
    errors: list[BaseException] = []
    finished = asyncio.Event()

    async def on_next(event: ObserverNotification) -> None:
        rows.append(f"block {event['block']['number']}")

    async def on_error(error: BaseException) -> None:
        errors.append(error)
        finished.set()

    async def on_complete() -> None:
        rows.append("complete")
        finished.set()

    async with create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain:
        bot = WorkerBee(chain)
        subscription = bot.provide_past_operations(96_549_390, 96_549_390).on_block().subscribe(
            on_next=on_next,
            on_error=on_error,
            on_complete=on_complete,
        )
        try:
            async with asyncio.timeout(45):
                await finished.wait()
            if errors:
                raise errors[0]
        finally:
            subscription.close()
            await bot.aclose()

    print(rows)


asyncio.run(main())
```

Always provide `on_error` for replay scripts. Errors happen asynchronously after subscription, so wrapping only `.subscribe(...)` in `try`/`except` will not catch most replay failures.

```python
import asyncio

from workerbee import ObserverNotification, WorkerBee


class OfflineChain:
    pass


async def main() -> None:
    errors: list[str] = []
    finished = asyncio.Event()
    bot = WorkerBee(OfflineChain())

    def on_error(error: BaseException) -> None:
        errors.append(type(error).__name__)
        finished.set()

    subscription = bot.provide_past_operations(-1, -1).on_block().subscribe(on_error=on_error)
    try:
        async with asyncio.timeout(5):
            await finished.wait()
    finally:
        subscription.close()
        await bot.aclose()

    print(errors)


asyncio.run(main())
```

## Endpoint Dependencies

Historical replay still depends on a live, reachable Hive API endpoint:

- bounded replay uses `block_api.get_block_range(...)`;
- relative replay first uses `database_api.get_dynamic_global_properties()`;
- some providers used during replay may call JSON-RPC APIs for extra data.

If the endpoint does not support the required APIs, is behind the requested block range, or temporarily returns no blocks, the replay can fail through `on_error` or complete earlier than expected. Keep examples bounded with small ranges and explicit `asyncio.timeout(...)`.

`PastQueen` intentionally rejects live-only observers and providers that require current account/feed/RC/witness state. Examples include `provide_accounts(...)`, `provide_rc_accounts(...)`, feed-price observers, manabar observers, balance-change observers, account metadata observers, account alarm observers, and witness missed-block observers.

```python
from workerbee import WorkerBee
from workerbee.chain_observers import WorkerBeeError


class OfflineChain:
    pass


bot = WorkerBee(OfflineChain())
past = bot.provide_past_operations(96_549_390, 96_549_391)
try:
    past.provide_accounts("alice")
except WorkerBeeError as error:
    print(str(error).split(";")[0])
```

## Replay To Live

The Python implementation does not automatically keep the same historical subscription alive after the replay range finishes. When replay is exhausted, the historical mediator completes and unregisters its listeners. `PastQueen.on_unsubscribe()` does merge compatible replay collector state into the parent `WorkerBee` mediator, but `Subscription.close()` unregisters the historical listener before that merge.

The practical pattern is to use the same `WorkerBee`, wait for the bounded replay to complete, close the replay subscription, then create a live subscription from `bot.observe` and start the bot's live polling loop.

```python
import asyncio

from wax import WaxChainOptions, create_hive_chain

from workerbee import WorkerBee


async def main() -> None:
    historical: list[int] = []
    live: list[int] = []
    errors: list[BaseException] = []
    replay_done = asyncio.Event()
    live_done = asyncio.Event()

    def on_historical(event: ObserverNotification) -> None:
        historical.append(event["block"]["number"])

    def on_live(event: ObserverNotification) -> None:
        live.append(event["block"]["number"])
        live_done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        replay_done.set()
        live_done.set()

    async with create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain:
        bot = WorkerBee(chain)
        replay_subscription = bot.provide_past_operations(96_549_390, 96_549_390).on_block().subscribe(
            on_next=on_historical,
            on_error=on_error,
            on_complete=replay_done.set,
        )
        try:
            async with asyncio.timeout(45):
                await replay_done.wait()
            if errors:
                raise errors[0]

            replay_subscription.close()

            live_subscription = bot.observe.on_block().subscribe(on_next=on_live, on_error=on_error)
            try:
                await bot.start()
                async with asyncio.timeout(30):
                    await live_done.wait()
                if errors:
                    raise errors[0]
            finally:
                live_subscription.close()
        finally:
            replay_subscription.close()
            await bot.aclose()

    print({"historical": historical, "live_count": len(live)})


asyncio.run(main())
```

## Open Questions

- The top-level README says historical replay can "directly switch to the live data without losing any context." Current Python code and tests show natural replay exhaustion completes the `PastQueen` subscription without live handoff. `on_unsubscribe()` merges compatible collector state, but the historical listener has already been unregistered before that merge. It is unclear whether automatic continuation of the same callback is intended.
- The async iterator API does not expose `on_complete` as a queued sentinel for finite historical replay. Callback subscriptions are the documented bounded pattern here; whether `async for` over a finite `PastQueen` should terminate naturally is unclear.
- Factory-level replay errors without an `on_error` callback are dispatched with `raise_unhandled=False`. Users should provide `on_error`; the intended behavior without one is not explicit in user-facing docs.
