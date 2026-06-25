"""JSON-RPC mock social and portfolio scenarios ported from the TS suite."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol, cast

import pytest
from wax.interfaces import IHiveChainInterface

from tests.mock._js_mock_server import MAX_MOCK_NOTIFY_CYCLES, collect_until, with_js_mock_bot
from workerbee import WorkerBee
from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.payloads import ObserverNotification

pytestmark = pytest.mark.jsonrpc_mock

HIVE_NAI = "@@000000021"


class _AmountCarrier(Protocol):
    amount: str | int


def _hive_threshold(coins: int) -> dict[str, int | str]:
    return {"amount": coins * 1000, "nai": HIVE_NAI, "precision": 3}


def _amount_value(amount: object) -> str:
    if isinstance(amount, Mapping):
        raw = cast("Mapping[str, object]", amount)["amount"]
        return str(raw)
    if isinstance(amount, str):
        return amount.split()[0].replace(".", "")
    if hasattr(amount, "amount"):
        return str(cast("_AmountCarrier", amount).amount)
    raise TypeError(f"Unsupported asset payload: {amount!r}")


def _append_once(values: list[str], value: str) -> None:
    if value not in values:
        values.append(value)


@pytest.mark.asyncio
async def test_mock_social_dashboard(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of TS mock scenario 3.1: real-time social dashboard."""

    async def scenario(bot: WorkerBee) -> list[str]:
        rows: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            assert note["accounts"]["gtg"]["name"] == "gtg"
            assert note["manabar_data"]["gtg"][ManabarType.RC]["current_mana"] == 2152098568737624

            for pair in note.get("posts", {}).get("gtg", []):
                operation = pair["operation"]
                _append_once(rows, f"0|Post: {operation['author']} - {operation['title']}")
            for pair in note.get("votes", {}).get("gtg", []):
                operation = pair["operation"]
                _append_once(rows, f"1|Vote: {operation['voter']} - {operation['author']}")
            for pair in note.get("comments", {}).get("gtg", []):
                operation = pair["operation"]
                _append_once(rows, f"2|Comment: {operation['author']} -> {operation['parent_author']}")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_posts("gtg")
                .or_.on_comments("gtg")
                .or_.on_votes("gtg")
                .provide_accounts("gtg")
                .provide_manabar_data(ManabarType.RC, "gtg")
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(rows) == 3,
        )
        return [row.split("|", maxsplit=1)[1] for row in sorted(rows)]

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Post: gtg - SkyTeam Airline Alliance - Official partner of HiveFest",
        "Vote: gtg - hbd.funder",
        "Comment: gtg -> purepinay",
    ]


@pytest.mark.asyncio
async def test_mock_investment_portfolio_monitor(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of TS mock scenario 3.5: investment portfolio monitor."""

    async def scenario(bot: WorkerBee) -> list[str]:
        rows: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for pair in note.get("exchange_transfer_operations", []):
                operation = pair["operation"]
                _append_once(rows, f"Exchange transfer: {operation['from']} -> {operation['to']} ({_amount_value(operation['amount'])})")
            for pair in note.get("whale_operations", []):
                operation = pair["operation"]
                _append_once(rows, f"Whale alert: {operation['from']} -> {operation['to']} ({_amount_value(operation['amount'])})")

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_accounts_balance_change(True, "gtg", "blocktrades")
                .or_.on_whale_alert(_hive_threshold(1000))
                .or_.on_exchange_transfer()
                .provide_accounts("gtg", "blocktrades")
                .subscribe(on_next=on_next)
            ),
            lambda _received: len(rows) >= 4,
        )
        return rows

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Exchange transfer: mxchive -> inhivepool (23890)",
        "Exchange transfer: bdhivesteem -> gtg (1000)",
        "Whale alert: mxchive -> inhivepool (23890)",
        "Whale alert: blocktrades -> gtg (10000000)",
    ]


@pytest.mark.asyncio
async def test_mock_content_aggregation_service(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of TS mock scenario 3.6: content aggregation service."""

    async def scenario(bot: WorkerBee) -> list[str]:
        rows: list[str] = []

        def on_next(note: ObserverNotification) -> None:
            for author in ("mtyszczak", "fwaszkiewicz"):
                for pair in note.get("posts", {}).get(author, []):
                    operation = pair["operation"]
                    _append_once(rows, f"Post: {operation['author']} - {operation['title']}")

            for pair in note.get("reblogs", {}).get("thebeedevs", []):
                operation = pair["operation"]
                _append_once(rows, f"Reblog: {operation['account']} -> {operation['author']}/{operation['permlink']}")

        await collect_until(
            bot,
            lambda _received: (bot.observe.on_posts("mtyszczak").or_.on_posts("fwaszkiewicz").or_.on_reblog("thebeedevs").subscribe(on_next=on_next)),
            lambda _received: len(rows) == 3,
        )
        return rows

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == [
        "Post: mtyszczak - Write on Hive, Read Everywhere!",
        "Post: fwaszkiewicz - Hi To Hive! 🐝",
        "Reblog: thebeedevs -> fwaszkiewicz/hi-to-hive",
    ]


@pytest.mark.asyncio
async def test_mock_engagement_optimization_bot(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of TS mock scenario 3.7: engagement optimization bot."""

    async def scenario(bot: WorkerBee) -> str:
        content: list[str] = []
        result = ""

        def on_next(note: ObserverNotification) -> None:
            nonlocal result

            for pair in note.get("posts", {}).get("fwaszkiewicz", []):
                operation = pair["operation"]
                _append_once(content, f"Post: {operation['author']} - {operation['title']}")
            for pair in note.get("comments", {}).get("fwaszkiewicz", []):
                operation = pair["operation"]
                _append_once(content, f"Comment: {operation['author']} -> {operation['parent_author']}")

            upvote_manabar = note["manabar_data"]["gtg"][ManabarType.UPVOTE]
            if upvote_manabar["percent"] >= 90 and len(content) >= 2:
                percent = f"{upvote_manabar['percent']:g}"
                result = f"Reached 90% of manabar for upvote: {percent}, available content: {','.join(content)}"

        await collect_until(
            bot,
            lambda _received: (
                bot.observe.on_accounts_manabar_percent(ManabarType.UPVOTE, 90, "gtg")
                .or_.on_posts("fwaszkiewicz")
                .or_.on_comments("fwaszkiewicz")
                .provide_manabar_data(ManabarType.UPVOTE, "gtg")
                .subscribe(on_next=on_next)
            ),
            lambda _received: bool(result),
            max_cycles=MAX_MOCK_NOTIFY_CYCLES,
        )
        return result

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == ("Reached 90% of manabar for upvote: 100, available content: Post: fwaszkiewicz - Hi To Hive! 🐝,Comment: fwaszkiewicz -> mtyszczak")
