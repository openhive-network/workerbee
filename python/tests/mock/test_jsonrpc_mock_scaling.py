"""Ports of TS JSON-RPC mock scaling scenarios."""

from __future__ import annotations

from collections.abc import Callable

import pytest
from wax.interfaces import IHiveChainInterface

from tests.mock._js_mock_server import MAX_MOCK_NOTIFY_CYCLES, collect_until, with_js_mock_bot
from workerbee import WorkerBee
from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.payloads import ObserverNotification
from workerbee.chain_observers.queen import Subscription

pytestmark = pytest.mark.jsonrpc_mock

type AssetThreshold = dict[str, int | str]
type DonePredicate = Callable[[list[ObserverNotification]], bool]
type RegistrationBuilder = Callable[[WorkerBee, list[ObserverNotification]], Subscription]

_HIGH_VOLUME_TRANSACTION_IDS = (
    "1c4b64f563f143284ca38dc66b3c2c71d314780f",
    "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
    "6bcf068618d8b66882cca5b94cd8de74215553df",
)


def _hive_asset(coins: int) -> AssetThreshold:
    return {"amount": str(coins * 1000), "nai": "@@000000021", "precision": 3}


async def _collect_mock_notifications(
    chain: IHiveChainInterface,
    register: RegistrationBuilder,
    is_done: DonePredicate,
    *,
    max_cycles: int = MAX_MOCK_NOTIFY_CYCLES,
) -> list[ObserverNotification]:
    async def scenario(bot: WorkerBee) -> list[ObserverNotification]:
        return await collect_until(
            bot,
            lambda received: register(bot, received),
            is_done,
            max_cycles=max_cycles,
        )

    return await with_js_mock_bot(chain, scenario)


def _first_note_where(
    notes: list[ObserverNotification],
    predicate: Callable[[ObserverNotification], bool],
    description: str,
) -> ObserverNotification:
    for note in notes:
        if predicate(note):
            return note
    pytest.fail(f"Expected notification with {description}")


def _str_field(operation: dict[str, object], key: str) -> str:
    value = operation[key]
    assert isinstance(value, str)
    return value


def _int_field(operation: dict[str, object], key: str) -> int:
    value = operation[key]
    assert isinstance(value, int)
    return value


def _asset_amount(asset: object) -> str:
    assert isinstance(asset, dict)
    value = asset.get("amount")
    assert isinstance(value, str | int)
    return str(value)


def _feed_percent_change(note: ObserverNotification) -> float:
    price_history = note["feed_price"]["price_history"]
    price1 = int(price_history[0].base.amount) / int(price_history[0].quote.amount)
    price2 = int(price_history[1].base.amount) / int(price_history[1].quote.amount)
    return abs(price1 - price2) / price2 * 100


def _seen_requested_transaction_ids(notes: list[ObserverNotification]) -> list[str]:
    seen = {tx_id for note in notes for tx_id in note.get("transactions", {})}
    return [tx_id for tx_id in _HIGH_VOLUME_TRANSACTION_IDS if tx_id in seen]


@pytest.mark.asyncio
async def test_multi_filter_performance_pipeline(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("posts", {}).get("gtg", []):
                content.append(f"Post by gtg: {pair['operation']['title']}")
            for pair in note.get("posts", {}).get("blocktrades", []):
                content.append(f"Post by blocktrades: {pair['operation']['title']}")
            for pair in note.get("comments", {}).get("gtg", []):
                content.append(f"Comment by gtg: {pair['operation']['parent_author']}")
            for pair in note.get("comments", {}).get("blocktrades", []):
                content.append(f"Comment by blocktrades: {pair['operation']['parent_author']}")
            for pair in note.get("votes", {}).get("gtg", []):
                content.append(f"Vote by gtg: {pair['operation']['author']}")
            for pair in note.get("votes", {}).get("blocktrades", []):
                content.append(f"Vote by blocktrades: {pair['operation']['author']}")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_posts("gtg")
                .or_.on_posts("blocktrades")
                .or_.on_comments("gtg")
                .or_.on_comments("blocktrades")
                .or_.on_votes("gtg")
                .or_.on_votes("blocktrades")
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 3,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Vote by gtg: hbd.funder",
        "Comment by gtg: purepinay",
        "Post by gtg: SkyTeam Airline Alliance - Official partner of HiveFest",
    ]


@pytest.mark.asyncio
async def test_high_volume_transaction_monitor(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    repeated_ids = _HIGH_VOLUME_TRANSACTION_IDS * 20

    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_transaction_ids(*repeated_ids).subscribe(on_next=got.append),
        lambda got: _seen_requested_transaction_ids(got) == list(_HIGH_VOLUME_TRANSACTION_IDS),
    )

    assert _seen_requested_transaction_ids(received) == list(_HIGH_VOLUME_TRANSACTION_IDS)
    for note in received:
        assert set(note["transactions"]) <= set(_HIGH_VOLUME_TRANSACTION_IDS)


@pytest.mark.asyncio
async def test_massive_account_monitoring_single_account(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: (
            bot.observe.on_accounts_balance_change(False, "gtg").or_.on_accounts_metadata_change("gtg").provide_accounts("gtg").subscribe(on_next=got.append)
        ),
        lambda got: bool(got and got[-1].get("accounts", {}).get("gtg")),
    )

    account = received[-1]["accounts"]["gtg"]
    assert account is not None
    assert account["name"] == "gtg"
    assert account["balance"]["HIVE"]["liquid"].amount == "0"
    profile = account["json_metadata"].get("profile")
    assert isinstance(profile, dict)
    assert profile["witness_description"] == "Gandalf the Grey, changed metadata."


@pytest.mark.asyncio
async def test_high_frequency_event_processing(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            content.append(f"Block processed: {note['block']['number']}")
            for pair in note.get("votes", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"High-frequency vote: {operation['voter']} -> {operation['author']}")
            for pair in note.get("comments", {}).get("fwaszkiewicz", []):
                operation = pair["operation"]
                content.append(f"High-frequency comment: {operation['author']} -> {operation['parent_author']}")
            for pair in note.get("internal_market_operations", []):
                operation = pair["operation"]
                content.append(f"High-frequency market op: {operation['owner']} - {operation['order_id']}")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_block()
                .or_.on_votes("gtg")
                .or_.on_comments("fwaszkiewicz")
                .or_.on_internal_market_operation()
                .provide_block_data()
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 4,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Block processed: 97477291",
        "Block processed: 97477292",
        "High-frequency vote: gtg -> hbd.funder",
        "Block processed: 97477293",
    ]


@pytest.mark.asyncio
async def test_economic_research_platform(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("whale_operations", []):
                operation = pair["operation"]
                content.append(f"Economic whale alert: {operation['from']} -> {operation['to']} ({_asset_amount(operation['amount'])})")
            if "feed_price" in note and _feed_percent_change(note) >= 1:
                content.append(f"Economic price change: {_feed_percent_change(note):.2f}%")
            for pair in note.get("internal_market_operations", []):
                operation = pair["operation"]
                content.append(f"Economic market operation: {operation['owner']} - order {operation['order_id']}")
            for pair in note.get("exchange_transfer_operations", []):
                operation = pair["operation"]
                content.append(f"Economic exchange transfer: {operation['from']} -> {operation['to']} ({_asset_amount(operation['amount'])})")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_whale_alert(_hive_asset(10000))
                .or_.on_feed_price_change(1)
                .or_.on_internal_market_operation()
                .or_.on_exchange_transfer()
                .provide_feed_price_data()
                .provide_block_data()
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 8,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Economic price change: 134.31%",
        "Economic price change: 134.31%",
        "Economic price change: 134.31%",
        "Economic whale alert: mxchive -> inhivepool (23890)",
        "Economic price change: 134.31%",
        "Economic market operation: honeybot - order 1485200410",
        "Economic exchange transfer: mxchive -> inhivepool (23890)",
        "Economic exchange transfer: bdhivesteem -> gtg (1000)",
    ]


@pytest.mark.asyncio
async def test_content_recommendation_engine(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("posts", {}).get("mtyszczak", []):
                operation = pair["operation"]
                content.append(f"Recommended post: {operation['author']} - {operation['title']}")
            for pair in note.get("reblogs", {}).get("thebeedevs", []):
                operation = pair["operation"]
                content.append(f"Recommended reblog: {operation['account']} -> {operation['author']}/{operation['permlink']}")
            for pair in note.get("votes", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Quality curator vote: {operation['voter']} -> {operation['author']}")
            for operation in note.get("mentioned", {}).get("gtg", []):
                content.append(f"Trending mention: {operation['author']} -> {operation['permlink']}")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_posts("mtyszczak")
                .or_.on_reblog("thebeedevs")
                .or_.on_votes("gtg")
                .or_.on_mention("gtg")
                .provide_accounts("mtyszczak", "thebeedevs", "gtg")
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 5,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Quality curator vote: gtg -> hbd.funder",
        "Recommended post: mtyszczak - Write on Hive, Read Everywhere!",
        "Recommended reblog: thebeedevs -> fwaszkiewicz/hi-to-hive",
        "Trending mention: mtyszczak -> write-on-hive-read-everywhere",
        "Trending mention: fwaszkiewicz -> hi-to-hive",
    ]


@pytest.mark.asyncio
async def test_automated_trading_signal_generator(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("whale_operations", []):
                operation = pair["operation"]
                content.append(f"Trading signal - Large whale movement: {operation['from']} -> {operation['to']} ({_asset_amount(operation['amount'])})")
            if "feed_price" in note and _feed_percent_change(note) >= 3:
                content.append(f"Trading signal - Significant price change: {_feed_percent_change(note):.2f}%")
            for witness_name in ("gtg", "blocktrades"):
                witness = note.get("witnesses", {}).get(witness_name)
                if witness is not None and witness["total_missed_blocks"] >= 5:
                    content.append(f"Trading signal - Witness reliability issue: {witness_name} missed {witness['total_missed_blocks']} blocks")
            for pair in note.get("internal_market_operations", []):
                operation = pair["operation"]
                content.append(f"Trading signal - Market activity: {operation['owner']} order {operation['order_id']}")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_whale_alert(_hive_asset(50000))
                .or_.on_feed_price_change(3)
                .or_.on_witnesses_missed_blocks(5, "gtg", "blocktrades")
                .or_.on_internal_market_operation()
                .provide_feed_price_data()
                .provide_witnesses("gtg", "blocktrades")
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 3,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Trading signal - Significant price change: 134.31%",
        "Trading signal - Witness reliability issue: gtg missed 988 blocks",
        "Trading signal - Witness reliability issue: blocktrades missed 3728 blocks",
    ]


@pytest.mark.asyncio
async def test_multiple_or_chaining(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("posts", {}).get("gtg", []):
                content.append(f"Chained post gtg: {pair['operation']['title']}")
            for pair in note.get("posts", {}).get("mtyszczak", []):
                content.append(f"Chained post mtyszczak: {pair['operation']['title']}")
            for pair in note.get("posts", {}).get("fwaszkiewicz", []):
                content.append(f"Chained post fwaszkiewicz: {pair['operation']['title']}")
            for pair in note.get("comments", {}).get("gtg", []):
                content.append(f"Chained comment gtg: {pair['operation']['parent_author']}")
            for pair in note.get("comments", {}).get("fwaszkiewicz", []):
                content.append(f"Chained comment fwaszkiewicz: {pair['operation']['parent_author']}")
            for pair in note.get("votes", {}).get("gtg", []):
                content.append(f"Chained vote gtg: {pair['operation']['author']}")
            for pair in note.get("follows", {}).get("gtg", []):
                content.append(f"Chained follow gtg: {pair['operation']['following']}")
            for pair in note.get("reblogs", {}).get("thebeedevs", []):
                operation = pair["operation"]
                content.append(f"Chained reblog thebeedevs: {operation['author']}/{operation['permlink']}")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_posts("gtg")
                .or_.on_posts("blocktrades")
                .or_.on_posts("mtyszczak")
                .or_.on_posts("fwaszkiewicz")
                .or_.on_comments("gtg")
                .or_.on_comments("fwaszkiewicz")
                .or_.on_votes("gtg")
                .or_.on_votes("blocktrades")
                .or_.on_follow("gtg")
                .or_.on_reblog("thebeedevs")
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 7,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Chained vote gtg: hbd.funder",
        "Chained post mtyszczak: Write on Hive, Read Everywhere!",
        "Chained post fwaszkiewicz: Hi To Hive! 🐝",
        "Chained comment gtg: purepinay",
        "Chained comment fwaszkiewicz: mtyszczak",
        "Chained follow gtg: thebeedevs",
        "Chained reblog thebeedevs: fwaszkiewicz/hi-to-hive",
    ]


@pytest.mark.asyncio
async def test_repeated_or_operations(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: (bot.observe.on_block().or_.or_.or_.or_.on_posts("gtg").provide_block_data().subscribe(on_next=got.append)),
        lambda got: len(got) >= 2,
    )

    assert [note["block"]["number"] for note in received[:2]] == [97477291, 97477292]
    assert all("block" in note for note in received[:2])


@pytest.mark.asyncio
async def test_provider_type_duplication(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: (
            bot.observe.on_block()
            .provide_accounts("gtg")
            .provide_accounts("blocktrades")
            .provide_accounts("thebeedevs")
            .provide_manabar_data(ManabarType.RC, "gtg")
            .provide_manabar_data(ManabarType.UPVOTE, "gtg")
            .provide_manabar_data(ManabarType.DOWNVOTE, "gtg")
            .provide_manabar_data(ManabarType.RC, "blocktrades")
            .subscribe(on_next=got.append)
        ),
        lambda got: bool(got and got[-1].get("accounts") and got[-1].get("manabar_data")),
    )

    note = received[-1]
    assert note["accounts"]["gtg"]["name"] == "gtg"
    assert note["accounts"]["blocktrades"]["name"] == "blocktrades"
    assert note["accounts"]["thebeedevs"]["name"] == "thebeedevs"
    assert note["manabar_data"]["gtg"][ManabarType.RC]["current_mana"] == 380450521230160
    assert note["manabar_data"]["gtg"][ManabarType.UPVOTE]["current_mana"] == 2897631713028020
    assert note["manabar_data"]["blocktrades"][ManabarType.RC]["current_mana"] == 29850078403493


@pytest.mark.asyncio
async def test_complex_nested_filter_combinations(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("posts", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Complex post: {operation['author']} - {operation['title']}")
            for pair in note.get("comments", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Complex comment: {operation['author']} -> {operation['parent_author']}")
            for pair in note.get("votes", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Complex vote: {operation['voter']} -> {operation['author']}")
            for pair in note.get("follows", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Complex follow: {operation['follower']} -> {operation['following']}")
            for pair in note.get("reblogs", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Complex reblog: {operation['account']} -> {operation['author']}/{operation['permlink']}")
            for operation in note.get("mentioned", {}).get("gtg", []):
                content.append(f"Complex mention: {operation['author']} -> {operation['permlink']}")
            for pair in note.get("whale_operations", []):
                operation = pair["operation"]
                content.append(f"Complex whale: {operation['from']} -> {operation['to']} ({_asset_amount(operation['amount'])})")
            for pair in note.get("internal_market_operations", []):
                operation = pair["operation"]
                content.append(f"Complex market: {operation['owner']} - {operation['order_id']}")
            for pair in note.get("exchange_transfer_operations", []):
                operation = pair["operation"]
                content.append(f"Complex exchange: {operation['from']} -> {operation['to']} ({_asset_amount(operation['amount'])})")
            for account in note.get("new_accounts", []):
                content.append(f"Complex new account: {account['account_name']}")
            for pair in note.get("custom_operations", {}).get("follow", []):
                content.append(f"Complex custom: {pair['operation']['id']}")

        await collect_until(
            bot,
            lambda _got: (
                bot.observe.on_posts("gtg")
                .or_.on_comments("gtg")
                .or_.on_votes("gtg")
                .or_.on_follow("gtg")
                .or_.on_reblog("gtg")
                .or_.on_mention("gtg")
                .or_.on_whale_alert(_hive_asset(1000))
                .or_.on_internal_market_operation()
                .or_.on_exchange_transfer()
                .or_.on_new_account()
                .or_.on_custom_operation("follow")
                .or_.on_accounts_balance_change(False, "gtg")
                .or_.on_accounts_metadata_change("gtg")
                .or_.on_feed_price_change(2)
                .provide_accounts("gtg")
                .provide_manabar_data(ManabarType.RC, "gtg")
                .provide_block_data()
                .provide_feed_price_data()
                .subscribe(on_next=on_next)
            ),
            lambda _got: len(content) >= 15,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Complex vote: gtg -> hbd.funder",
        "Complex comment: gtg -> purepinay",
        "Complex follow: gtg -> thebeedevs",
        "Complex reblog: gtg -> fwaszkiewicz/hi-to-hive",
        "Complex mention: mtyszczak -> write-on-hive-read-everywhere",
        "Complex mention: fwaszkiewicz -> hi-to-hive",
        "Complex whale: mxchive -> inhivepool (23890)",
        "Complex whale: blocktrades -> gtg (10000000)",
        "Complex market: honeybot - 1485200410",
        "Complex exchange: mxchive -> inhivepool (23890)",
        "Complex exchange: bdhivesteem -> gtg (1000)",
        "Complex custom: follow",
        "Complex custom: follow",
        "Complex custom: follow",
        "Complex custom: follow",
    ]


@pytest.mark.asyncio
async def test_manabar_callback_for_empty_account(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_accounts_manabar_percent(ManabarType.UPVOTE, 90, "barddev").subscribe(on_next=got.append),
        lambda got: bool(got and got[-1].get("manabar_data", {}).get("barddev")),
    )

    manabar = received[-1]["manabar_data"]["barddev"][ManabarType.UPVOTE]
    assert manabar["current_mana"] == 0
    assert manabar["max"] == 0
    assert manabar["percent"] == 0


@pytest.mark.asyncio
async def test_manabar_callback_for_existing_account(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_accounts_manabar_percent(ManabarType.UPVOTE, 90, "gtg").subscribe(on_next=got.append),
        lambda got: bool(got and got[-1].get("manabar_data", {}).get("gtg")),
    )

    manabar = received[-1]["manabar_data"]["gtg"][ManabarType.UPVOTE]
    assert manabar["current_mana"] == manabar["max"]
    assert manabar["percent"] == 100


@pytest.mark.asyncio
async def test_manabar_callback_for_empty_and_existing_accounts(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_accounts_manabar_percent(ManabarType.UPVOTE, 90, "barddev", "gtg").subscribe(on_next=got.append),
        lambda got: bool(got and {"barddev", "gtg"}.issubset(got[-1].get("manabar_data", {}))),
    )

    manabar_data = received[-1]["manabar_data"]
    assert manabar_data["barddev"][ManabarType.UPVOTE]["current_mana"] == 0
    assert manabar_data["barddev"][ManabarType.UPVOTE]["max"] == 0
    assert manabar_data["gtg"][ManabarType.UPVOTE]["current_mana"] == 2944815083303610
    assert manabar_data["gtg"][ManabarType.UPVOTE]["max"] == 2967310839581315


@pytest.mark.asyncio
async def test_detects_new_vote(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_votes("gtg").subscribe(on_next=got.append),
        lambda got: bool(got and got[-1].get("votes", {}).get("gtg")),
    )

    vote = received[-1]["votes"]["gtg"][0]["operation"]
    assert _str_field(vote, "voter") == "gtg"
    assert _str_field(vote, "author") == "hbd.funder"
    assert _int_field(vote, "weight") == 10000


@pytest.mark.asyncio
async def test_detects_account_metadata_change(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_accounts_metadata_change("gtg").subscribe(on_next=got.append),
        lambda got: bool(got and got[-1].get("accounts", {}).get("gtg")),
    )

    account = received[-1]["accounts"]["gtg"]
    assert account is not None
    profile = account["json_metadata"].get("profile")
    assert isinstance(profile, dict)
    assert profile["witness_description"] == "Gandalf the Grey, changed metadata."


@pytest.mark.asyncio
async def test_detects_account_balance_change(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    received = await _collect_mock_notifications(
        js_jsonrpc_mock_chain,
        lambda bot, got: bot.observe.on_accounts_balance_change(False, "gtg").subscribe(on_next=got.append),
        lambda got: bool(got and got[-1].get("accounts", {}).get("gtg")),
    )

    account = received[-1]["accounts"]["gtg"]
    assert account is not None
    assert account["balance"]["HBD"]["savings"].amount == "3468"
    assert account["balance"]["HBD"]["total"].amount == "3662"
