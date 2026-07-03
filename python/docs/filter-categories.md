# WorkerBee Filter Categories for Python

WorkerBee observer chains are built from `bot.observe`, a fresh `QueenBee` builder returned by every access. Methods named `on_*` add event filters. Most of them also add the matching payload provider automatically, but some are filter-only and need a `provide_*` method if the callback should receive extra payload data.

Provider-only methods do not filter events. They only add payload fields to a chain. If a chain contains only provider methods, `subscribe()` uses a blank filter and the observer is eligible for every evaluated block.

The examples below only construct and close observer chains. They intentionally do not call `start()`, `notify()`, or historical replay, so they do not wait for live chain events. Real applications should pass a Hive chain to `WorkerBee`; these validation examples use a tiny dry-run chain that only implements the `extends(...)` method WorkerBee calls during construction.

## Account Management

Account management filters track account creation, selected account state, selected manabar state, and operations that impact named accounts.

| Method | Kind | Description |
| --- | --- | --- |
| `on_new_account()` | Filters events and provides `new_accounts`. | Matches `account_create`, `account_create_with_delegation`, and `create_claimed_account` operations. |
| `on_accounts_metadata_change(*accounts)` | Filters events and provides `accounts`. | Watches `json_metadata` and `posting_json_metadata` for the selected accounts; the first observation stores baseline state. |
| `on_accounts_full_manabar(manabar_type, *accounts)` | Filters events and provides `manabar_data`. | Matches when a selected account's selected manabar is effectively full. It is shorthand for `on_accounts_manabar_percent(manabar_type, 98, *accounts)`. |
| `on_accounts_manabar_percent(manabar_type, percent, *accounts)` | Filters events and provides `manabar_data`. | Matches when a selected account's selected manabar percentage is at least `percent`. |
| `on_impacted_accounts(*accounts)` | Filters events and provides `impacted_accounts`. | Matches operations whose impacted-account set contains any selected account. |

```python
from typing import Self

from workerbee import ManabarType, ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

subscriptions = [
    bot.observe.on_new_account().subscribe(on_next=handle),
    bot.observe.on_accounts_metadata_change("alice").subscribe(on_next=handle),
    bot.observe.on_accounts_full_manabar(ManabarType.UPVOTE, "alice").subscribe(on_next=handle),
    bot.observe.on_accounts_manabar_percent(ManabarType.RC, 75, "alice").subscribe(on_next=handle),
    bot.observe.on_impacted_accounts("alice", "bob").subscribe(on_next=handle),
]

assert bot.mediator.has_listeners

for subscription in subscriptions:
    subscription.close()

assert not bot.mediator.has_listeners
```

## Social and Content

Social and content filters match Hive content operations, votes, mentions, follow-plugin custom JSON operations, and custom JSON ids.

| Method | Kind | Description |
| --- | --- | --- |
| `on_posts(*authors)` | Filters events and provides `posts`. | Matches top-level `comment_operation` entries where `parent_author == ""` and the author is selected. |
| `on_comments(*authors)` | Filters events and provides `comments`. | Matches reply `comment_operation` entries where `parent_author != ""` and the author is selected. |
| `on_posts_incoming_payout(relative_time_ms, *authors)` | Filters events and provides `posts_metadata`. | Matches selected posts whose content metadata reaches the requested window before payout. The first argument can be milliseconds or a relative string such as `"-30m"`. |
| `on_comments_incoming_payout(relative_time_ms, *authors)` | Filters events and provides `comments_metadata`. | Same payout-window filter as posts, but for replies. |
| `on_votes(*voters)` | Filters events and provides `votes`. | Matches `vote_operation` entries cast by selected voters. |
| `on_mention(*accounts)` | Filters events and provides `mentioned`. | Matches comment bodies containing `@account` mentions for selected accounts. |
| `on_reblog(*accounts)` | Filters events and provides `reblogs`. | Matches legacy follow-plugin `custom_json` reblog operations for selected reblogger accounts. |
| `on_follow(*accounts)` | Filters events and provides `follows`. | Matches legacy follow-plugin `custom_json` follow operations for selected follower accounts. |
| `on_custom_operation(*ids)` | Filters events and provides `custom_operations`. | Matches `custom_json_operation` entries whose `id` is one of the supplied ids. |

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

subscriptions = [
    bot.observe.on_posts("alice", "bob").subscribe(on_next=handle),
    bot.observe.on_comments("alice").subscribe(on_next=handle),
    bot.observe.on_posts_incoming_payout("-30m", "alice").subscribe(on_next=handle),
    bot.observe.on_comments_incoming_payout(60_000, "alice").subscribe(on_next=handle),
    bot.observe.on_votes("alice").subscribe(on_next=handle),
    bot.observe.on_mention("alice").subscribe(on_next=handle),
    bot.observe.on_reblog("alice").subscribe(on_next=handle),
    bot.observe.on_follow("alice").subscribe(on_next=handle),
    bot.observe.on_custom_operation("follow", "splinterlands").subscribe(on_next=handle),
]

assert len(subscriptions) == 9

for subscription in subscriptions:
    subscription.close()

assert not bot.mediator.has_listeners
```

## Financial Operations

Financial filters cover balance changes, transfers touching known exchanges, internal market orders, large transfers, and feed-price conditions.

| Method | Kind | Description |
| --- | --- | --- |
| `on_accounts_balance_change(include_internal_transfers, *accounts)` | Filters events and provides `accounts`. | Watches selected account balances. With `include_internal_transfers=False`, it compares total HP, HIVE, and HBD balances; with `True`, it compares all tracked balance buckets. The first observation stores baseline state. |
| `on_exchange_transfer()` | Filters events and provides `exchange_transfer_operations`. | Matches transfer-like operations where `from` or `to` is a known exchange account. |
| `on_internal_market_operation()` | Filters events and provides `internal_market_operations`. | Matches `limit_order_create`, `limit_order_create2`, and `limit_order_cancel` operations. |
| `on_whale_alert(asset)` | Filters events and provides `whale_operations`. | Matches transfer-like operations whose amount is greater than the supplied asset threshold. Escrow transfers check both HBD and HIVE amounts. |
| `on_feed_price_change(percent)` | Filter only. | Matches when the median feed price changes by at least `percent`. Add `provide_feed_price_data()` if the callback needs `feed_price`. |
| `on_feed_price_no_change(last_hours_count=24)` | Filter only. | Uses the TS-compatible feed-price trailing-window condition. Add `provide_feed_price_data()` if the callback needs `feed_price`. See Open Questions. |

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

subscriptions = [
    bot.observe.on_accounts_balance_change(False, "alice").subscribe(on_next=handle),
    bot.observe.on_exchange_transfer().subscribe(on_next=handle),
    bot.observe.on_internal_market_operation().subscribe(on_next=handle),
    bot.observe.on_whale_alert({"amount": 100_000, "nai": "@@000000021", "precision": 3}).subscribe(on_next=handle),
    bot.observe.on_feed_price_change(5).provide_feed_price_data().subscribe(on_next=handle),
    bot.observe.on_feed_price_no_change(24).provide_feed_price_data().subscribe(on_next=handle),
]

assert bot.mediator.has_listeners

for subscription in subscriptions:
    subscription.close()

assert not bot.mediator.has_listeners
```

## Security and Governance

Security and governance filters watch account alarm conditions and witness missed-block streaks.

| Method | Kind | Description |
| --- | --- | --- |
| `on_alarm(*accounts)` | Filters events and provides `alarms_per_account`. | Matches selected accounts with a legacy `steem` recovery account, expired or soon-expiring governance vote, pending recovery-account change, or voting-rights decline. |
| `on_witnesses_missed_blocks(missed_blocks_min_count, *witnesses)` | Filter only. | Tracks selected witnesses and matches when total missed blocks rises beyond the configured threshold while the witness is not producing blocks. Add `provide_witnesses()` if the callback needs witness data. |

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

alarm_subscription = bot.observe.on_alarm("alice").subscribe(on_next=handle)
witness_subscription = (
    bot.observe.on_witnesses_missed_blocks(3, "initminer")
    .provide_witnesses("initminer")
    .subscribe(on_next=handle)
)

assert bot.mediator.has_listeners

alarm_subscription.close()
witness_subscription.close()

assert not bot.mediator.has_listeners
```

## Blockchain Infrastructure

Infrastructure filters match blocks and transactions.

| Method | Kind | Description |
| --- | --- | --- |
| `on_block()` | Filters events and provides header-only `block`. | Matches each new block number observed by the live pipeline. |
| `on_block_number(number)` | Filter only. | Matches only the specified block number. Add `provide_block_header_data()` or `provide_block_data()` for block payloads. |
| `on_transaction_ids(*transaction_ids)` | Filters events and provides `transactions`. | Matches blocks containing any supplied transaction id and provides the matching transaction objects by id. |

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

subscriptions = [
    bot.observe.on_block().subscribe(on_next=handle),
    bot.observe.on_block_number(123_456).provide_block_header_data().subscribe(on_next=handle),
    bot.observe.on_block_number(123_456).provide_block_data().subscribe(on_next=handle),
    bot.observe.on_transaction_ids("0000000000000000000000000000000000000000").subscribe(on_next=handle),
]

assert bot.mediator.has_listeners

for subscription in subscriptions:
    subscription.close()

assert not bot.mediator.has_listeners
```

## Provider-Only Methods

Use provider-only methods to enrich events selected by filters. Used without an `on_*` filter, they do not narrow the subscription.

| Method | Kind | Description |
| --- | --- | --- |
| `provide_accounts(*accounts)` | Provider only. | Adds `accounts`, keyed by requested account name. |
| `provide_witnesses(*witnesses)` | Provider only. | Adds `witnesses`, keyed by requested witness owner name. |
| `provide_rc_accounts(*accounts)` | Provider only. | Adds `rc_accounts`, keyed by requested account name. |
| `provide_block_header_data()` | Provider only. | Adds header-only `block` data. |
| `provide_block_data()` | Provider only. | Adds full `block` data, including transactions and `transactions_per_id`. |
| `provide_feed_price_data()` | Provider only. | Adds `feed_price` data. |
| `provide_manabar_data(manabar_type, *accounts)` | Provider only. | Adds `manabar_data` for selected accounts and manabar types. |

```python
from typing import Self

from workerbee import ManabarType, ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

with bot.observe.on_block().provide_accounts("alice").provide_rc_accounts("alice").subscribe(on_next=handle):
    assert bot.mediator.has_listeners

with (
    bot.observe.on_block()
    .provide_witnesses("initminer")
    .provide_manabar_data(ManabarType.RC, "alice")
    .provide_feed_price_data()
    .subscribe(on_next=handle)
):
    assert bot.mediator.has_listeners

with bot.observe.provide_block_header_data().subscribe(on_next=handle):
    assert bot.mediator.has_listeners

assert not bot.mediator.has_listeners
```

## Combining Filters

Consecutive filter methods in one group are OR alternatives. Calling `.and_` or `.AND` closes the current OR group and starts a new AND group. `.or_` and `.OR` are readable aliases for staying in the current OR group.

```python
from typing import Self

from workerbee import ObserverNotification, WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection


class DryRunChain:
    def extends(self, api_collection: type[WorkerBeeApiCollection]) -> Self:
        return self


def handle(event: ObserverNotification) -> None:
    print(sorted(event))


bot = WorkerBee(DryRunChain())

posts_or_votes = bot.observe.on_posts("alice").or_.on_votes("alice").subscribe(on_next=handle)
post_and_vote_in_same_event = bot.observe.on_posts("alice").and_.on_votes("alice").subscribe(on_next=handle)
custom_or_exchange_with_block = (
    bot.observe.on_custom_operation("follow")
    .or_.on_exchange_transfer()
    .and_.on_block()
    .subscribe(on_next=handle)
)

assert bot.mediator.has_listeners

posts_or_votes.close()
post_and_vote_in_same_event.close()
custom_or_exchange_with_block.close()

assert not bot.mediator.has_listeners
```

## Open Questions

- `on_feed_price_no_change(last_hours_count=24)` maps to the TS `FeedPriceNoChangeFilter`, but the Python filter docstring says the TS-compatible implementation returns `True` when it finds a price change inside the trailing window. Confirm whether user-facing documentation should describe the current compatibility behavior or the apparent public method intent.
- `FeedPricePayload` in `payloads.py` mentions `on_feed_price_change(...)`, but `QueenBee.on_feed_price_change()` and `QueenBee.on_feed_price_no_change()` currently add filters only. The examples therefore chain `provide_feed_price_data()` explicitly.
