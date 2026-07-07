# Application Integration Notes

These notes cover the boundaries that matter when using WorkerBee inside a real
bot. They were clarified while porting an application that combines live
observation, historical chain state, signing, and broadcasting.

## Package Source

The package name is `hiveio-workerbee`:

```bash
pip install hiveio-workerbee
```

Post-release development builds used by this repository are published in the
Hive GitLab package registry. If `pip` cannot resolve the package from the
configured index, enable the Hive registry:

```bash
pip install --extra-index-url https://gitlab.syncad.com/api/v4/groups/136/-/packages/pypi/simple hiveio-workerbee
```

Applications should pin the version they were validated with when they depend
on development builds.

## WorkerBee Scope

WorkerBee observes blocks, operations, and derived chain data. It is the right
tool for live subscriptions and bounded historical replay:

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

        def handle(event: ObserverNotification) -> None:
            print(event["block"]["number"])
            done.set()

        subscription = bot.observe.on_block().subscribe(on_next=handle)
        try:
            async with asyncio.timeout(30):
                await done.wait()
        finally:
            subscription.close()


asyncio.run(main())
```

WorkerBee is not a replacement for every Hive API endpoint. If an application
needs an initial backlog such as recent posts/comments with `active_votes`, use
Bridge or another Hive JSON-RPC API directly for that backlog, then use
WorkerBee for new live events. A typical flow is:

```python
import httpx


async def fetch_recent_posts(endpoint: str, author: str) -> list[dict[str, object]]:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            endpoint,
            json={
                "jsonrpc": "2.0",
                "method": "bridge.get_account_posts",
                "params": {"sort": "posts", "account": author, "limit": 20},
                "id": 1,
            },
        )
    response.raise_for_status()
    return list(response.json().get("result") or [])
```

## Signing And Broadcasting

WorkerBee broadcasts signed transactions and waits until they are seen on
chain. It does not own private-key storage or wallet lifecycle. Applications
that sign transactions should use Wax and Beekeeper explicitly.

`hiveio-workerbee` depends on `hiveio-wax`, and Wax currently brings the
`beekeepy` module transitively. If your application imports `beekeepy` directly,
declare `hiveio-beekeepy` as an application dependency as well. That keeps the
application's direct imports visible in its own package metadata.

```python
from pathlib import Path
from tempfile import TemporaryDirectory

from beekeepy import AsyncBeekeeper
from beekeepy._interface.settings import InterfaceSettings
from wax.proto.operations import vote as vote_operation
from workerbee import WorkerBee


async def cast_vote(bot: WorkerBee, private_key: str, voter: str, author: str, permlink: str) -> None:
    with TemporaryDirectory() as directory:
        settings = InterfaceSettings(working_directory=Path(directory))
        async with await AsyncBeekeeper.factory(settings=settings) as beekeeper:
            session = await beekeeper.create_session()
            wallet = await session.create_wallet(name="workerbee-vote", password="local-password")
            await wallet.import_key(private_key=private_key)
            public_key = (await wallet.public_keys)[0]

            tx = await bot.chain.create_transaction()
            tx.push_operation(
                vote_operation(
                    voter=voter,
                    author=author,
                    permlink=permlink,
                    weight=10_000,
                ),
            )
            await tx.sign(wallet, public_key)

            tx_id = str(tx.id)
            await bot.broadcast(tx)
            print(f"broadcast transaction {tx_id}")
```

`WorkerBee.broadcast(...)` returns `None`. Read `str(tx.id)` from the
transaction object if the application needs a stable id for logs or storage.

## Vote Weight Units

Wax vote operations use Hive operation weights in basis points:

| Value | Meaning |
| --- | --- |
| `10_000` | 100% upvote |
| `1_000` | 10% upvote |
| `0` | neutral/no voting power |

Application settings often store vote weight as a percentage. Convert the
percentage before creating the operation:

```python
vote_weight_percent = 100
operation_weight = vote_weight_percent * 100
```

The exact operation schema is owned by Wax and Hive, but WorkerBee examples use
the same basis-point value because they pass Wax transaction objects through to
the chain.

## Full Manabar Threshold

`on_accounts_full_manabar(...)` is a convenience alias. It mirrors TypeScript
WorkerBee and expands to:

```python
bot.observe.on_accounts_manabar_percent(manabar_type, 98, *accounts)
```

Use `on_accounts_full_manabar(...)` when WorkerBee's "effectively full" default
is acceptable. If an application needs a stricter product rule, pass the exact
threshold explicitly:

```python
bot.observe.on_accounts_manabar_percent(ManabarType.UPVOTE, 99.98, "alice")
```

## Typed Notifications

Use the exported `ObserverNotification` type for callbacks. It gives editors and
type checkers the WorkerBee payload keys without falling back to `dict[str,
object]` or `dict[str, Any]`.

```python
from workerbee import ObserverNotification


def handle(event: ObserverNotification) -> None:
    impacted = event.get("impacted_accounts")
    if impacted is None:
        return
    for pair in impacted.get("alice", []):
        print(pair["operation"].type)
```

Each key remains optional because different observer chains provide different
payloads. Read with `.get(...)` when the callback accepts several possible
notification shapes, or use `has_payload(...)` when narrowing against a specific
payload fragment is clearer.
