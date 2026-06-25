"""Recorded JSON-RPC mock analysis scenarios ported from TypeScript."""

from __future__ import annotations

import pytest
from wax.interfaces import IHiveChainInterface

from tests.mock._js_mock_server import collect_until, with_js_mock_bot
from workerbee import WorkerBee
from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.payloads import (
    ExchangeTransferPair,
    FollowOperationPair,
    ObserverNotification,
    ReblogOperationPair,
)

pytestmark = pytest.mark.jsonrpc_mock


def _follow_operations(received: list[ObserverNotification], account: str) -> list[FollowOperationPair]:
    return [pair for note in received for pair in note.get("follows", {}).get(account, [])]


def _reblog_operations(received: list[ObserverNotification], account: str) -> list[ReblogOperationPair]:
    return [pair for note in received for pair in note.get("reblogs", {}).get(account, [])]


def _mention_operations(received: list[ObserverNotification], account: str) -> list[dict[str, object]]:
    return [operation for note in received for operation in note.get("mentioned", {}).get(account, [])]


def _transfer_amount(pair: ExchangeTransferPair) -> str:
    amount = pair["operation"]["amount"]
    assert isinstance(amount, dict)
    raw_amount = amount.get("amount")
    assert isinstance(raw_amount, str)
    return raw_amount


def _feed_percent_change(note: ObserverNotification) -> float:
    price_history = note["feed_price"]["price_history"]
    price1 = int(price_history[0].base.amount) / int(price_history[0].quote.amount)
    price2 = int(price_history[1].base.amount) / int(price_history[1].quote.amount)
    return abs(price1 - price2) / price2 * 100


@pytest.mark.asyncio
async def test_complete_account_analysis(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[ObserverNotification]:
        def has_complete_account_analysis(received: list[ObserverNotification]) -> bool:
            if not received:
                return False
            note = received[-1]
            return (
                note.get("accounts", {}).get("gtg") is not None
                and note.get("rc_accounts", {}).get("gtg") is not None
                and note.get("manabar_data", {}).get("gtg", {}).get(ManabarType.RC) is not None
                and note.get("manabar_data", {}).get("gtg", {}).get(ManabarType.UPVOTE) is not None
                and "block" in note
                and "feed_price" in note
            )

        return await collect_until(
            bot,
            lambda received: (
                bot.observe.on_block()
                .provide_accounts("gtg")
                .provide_rc_accounts("gtg")
                .provide_manabar_data(ManabarType.RC, "gtg")
                .provide_manabar_data(ManabarType.UPVOTE, "gtg")
                .provide_block_data()
                .provide_feed_price_data()
                .subscribe(on_next=received.append)
            ),
            has_complete_account_analysis,
        )

    received = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert received
    note = received[-1]
    account = note["accounts"]["gtg"]
    rc_account = note["rc_accounts"]["gtg"]
    assert account is not None
    assert rc_account is not None
    assert account["name"] == "gtg"
    assert account["balance"]["HBD"]["savings"].amount == "3468"
    assert rc_account["rc_manabar"]["current_mana"] == 2152098568737624
    rc_manabar = note["manabar_data"]["gtg"][ManabarType.RC]
    assert rc_manabar["current_mana"] == rc_account["rc_manabar"]["current_mana"]
    assert 0 <= rc_manabar["percent"] <= 100
    assert note["manabar_data"]["gtg"][ManabarType.UPVOTE]["current_mana"] == 18469160006473
    assert note["block"]["number"] == 97477291
    assert note["feed_price"]["price_history"][0].base.amount == "280"
    assert note["feed_price"]["price_history"][0].quote.amount == "1000"


@pytest.mark.asyncio
async def test_multi_account_comparison(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for account in ("gtg", "blocktrades", "thebeedevs"):
                account_data = note["accounts"].get(account)
                manabar_data = note["manabar_data"].get(account, {}).get(ManabarType.RC)
                if account_data is None or manabar_data is None:
                    continue
                content.append(f"Account: {account_data['name']}, Balance: {account_data['balance']['HBD']['savings'].amount}")
                content.append(f"RC mana: {manabar_data['current_mana']}")
                witness = note.get("witnesses", {}).get(account)
                if witness is not None:
                    content.append(f"Witnesses missed blocks: {witness['total_missed_blocks']}")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_block()
                .provide_accounts("gtg", "blocktrades", "thebeedevs")
                .provide_manabar_data(ManabarType.RC, "gtg", "blocktrades", "thebeedevs")
                .provide_witnesses("gtg", "blocktrades")
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(content) >= 8,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Account: gtg, Balance: 0",
        "RC mana: 161024584599674",
        "Witnesses missed blocks: 988",
        "Account: blocktrades, Balance: 130076015",
        "RC mana: 15564167323386971",
        "Witnesses missed blocks: 3728",
        "Account: thebeedevs, Balance: 215216",
        "RC mana: 3851154925254",
    ]


@pytest.mark.asyncio
async def test_comprehensive_market_analysis(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            block_number = note["block"]["number"]
            for pair in note.get("internal_market_operations", []):
                operation = pair["operation"]
                content.append(
                    f"Internal market operation: owner: {operation['owner']}, order id: {operation['order_id']}, block : {block_number}",
                )
            for pair in note.get("exchange_transfer_operations", []):
                operation = pair["operation"]
                content.append(f"Exchange transfer: {operation['from']} -> {operation['to']} ({_transfer_amount(pair)}), block: {block_number}")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_block()
                .or_.on_internal_market_operation()
                .or_.on_exchange_transfer()
                .provide_block_data()
                .provide_feed_price_data()
                .provide_accounts("gtg", "blocktrades")
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(content) >= 3,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Internal market operation: owner: honeybot, order id: 1485200410, block : 97477294",
        "Exchange transfer: mxchive -> inhivepool (23890), block: 97477294",
        "Exchange transfer: bdhivesteem -> gtg (1000), block: 97477294",
    ]


@pytest.mark.asyncio
async def test_social_network_analysis(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            account = note["accounts"].get("gtg")
            blocktrades = note["accounts"].get("blocktrades")
            for pair in note.get("follows", {}).get("gtg", []):
                content.append(f"Follow: {pair['operation']['follower']} -> {pair['operation']['following']}, ({account['name'] if account else None})")
            for pair in note.get("follows", {}).get("blocktrades", []):
                content.append(f"Follow: {pair['operation']['follower']} -> {pair['operation']['following']}, ({blocktrades['name'] if blocktrades else None})")
            for pair in note.get("reblogs", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Reblog: {operation['account']} -> {operation['author']}/{operation['permlink']} ({account['name'] if account else None})")
            for operation in note.get("mentioned", {}).get("gtg", []):
                content.append(f"Mention: {operation['author']} -> {operation['permlink']} ({account['name'] if account else None})")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_follow("gtg")
                .or_.on_follow("blocktrades")
                .or_.on_reblog("gtg")
                .or_.on_mention("gtg")
                .provide_accounts("gtg", "blocktrades")
                .provide_manabar_data(ManabarType.RC, "gtg", "blocktrades")
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(content) >= 5,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Follow: gtg -> thebeedevs, (gtg)",
        "Follow: blocktrades -> thebeedevs, (blocktrades)",
        "Reblog: gtg -> fwaszkiewicz/hi-to-hive (gtg)",
        "Mention: mtyszczak -> write-on-hive-read-everywhere (gtg)",
        "Mention: fwaszkiewicz -> hi-to-hive (gtg)",
    ]


@pytest.mark.asyncio
async def test_content_performance_dashboard(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            account = note["accounts"]["gtg"]
            assert account is not None
            current_mana = note["manabar_data"]["gtg"][ManabarType.UPVOTE]["current_mana"]
            account_name = account["name"]

            for pair in note.get("posts", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Post: {operation['author']} - {operation['title']} ({account_name}) ({current_mana})")
            for pair in note.get("comments", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Comment: {operation['author']} -> {operation['parent_author']} ({account_name}) ({current_mana})")
            for pair in note.get("votes", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Vote: {operation['voter']} - {operation['author']} ({account_name}) ({current_mana})")
            for pair in note.get("reblogs", {}).get("gtg", []):
                operation = pair["operation"]
                content.append(f"Reblog: {operation['account']} -> {operation['author']}/{operation['permlink']} ({account_name}) ({current_mana})")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_posts("gtg")
                .or_.on_comments("gtg")
                .or_.on_votes("gtg")
                .or_.on_reblog("gtg")
                .provide_accounts("gtg")
                .provide_manabar_data(ManabarType.UPVOTE, "gtg")
                .provide_block_data()
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(content) >= 4,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Vote: gtg - hbd.funder (gtg) (18469160006473)",
        "Comment: gtg -> purepinay (gtg) (18469160006473)",
        "Reblog: gtg -> fwaszkiewicz/hi-to-hive (gtg) (18469160006473)",
        "Post: gtg - SkyTeam Airline Alliance - Official partner of HiveFest (gtg) (18469160006473)",
    ]


@pytest.mark.asyncio
async def test_governance_monitoring_system(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    async def scenario(bot: WorkerBee) -> list[str]:
        content: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            witnesses = note.get("witnesses", {})
            for witness_name in ("gtg", "blocktrades"):
                witness = witnesses.get(witness_name)
                if witness is not None and witness["total_missed_blocks"] >= 3:
                    content.append(f"Witness missed blocks: {witness_name} - {witness['total_missed_blocks']}")

            if "feed_price" in note:
                percent_change = _feed_percent_change(note)
                if percent_change >= 2:
                    content.append(f"Feed price change: {percent_change:.2f}%")

            for pair in note.get("custom_operations", {}).get("witness_set_properties", []):
                operation = pair["operation"]
                required_auths = operation["required_auths"]
                assert isinstance(required_auths, list)
                content.append(f"Custom operation: {operation['id']} by {required_auths[0]}")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_witnesses_missed_blocks(3, "gtg", "blocktrades")
                .or_.on_feed_price_change(2)
                .or_.on_custom_operation("witness_set_properties")
                .provide_witnesses("gtg", "blocktrades")
                .provide_feed_price_data()
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(content) >= 3,
        )
        return content

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Witness missed blocks: gtg - 988",
        "Witness missed blocks: blocktrades - 3728",
        "Feed price change: 134.31%",
    ]
