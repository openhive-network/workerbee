"""Mirrornet-backed integration tests for finance and market observer hooks."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import pytest

from tests.integration._mirrornet import MirrornetReplay
from workerbee.chain_observers.enums import Exchange

if TYPE_CHECKING:
    from workerbee.chain_observers.payloads import ObserverNotification

HIVE_NAI = "@@000000021"


def _hive_threshold(coins: int) -> dict[str, int | str]:
    return {"amount": coins * 1000, "nai": HIVE_NAI, "precision": 3}


def _amount_value(amount: object) -> int:
    if isinstance(amount, dict):
        return int(amount["amount"])
    if isinstance(amount, str):
        return int(amount.split()[0].replace(".", ""))
    raise TypeError(f"Unsupported asset payload: {amount!r}")


def _market_operations(notes: list[ObserverNotification]) -> list[dict[str, Any]]:
    return [pair["operation"] for note in notes for pair in note.get("internal_market_operations", [])]


def _exchange_operations(notes: list[ObserverNotification]) -> list[dict[str, Any]]:
    return [pair["operation"] for note in notes for pair in note.get("exchange_transfer_operations", [])]


def _whale_operations(notes: list[ObserverNotification]) -> list[dict[str, Any]]:
    return [pair["operation"] for note in notes for pair in note.get("whale_operations", [])]


@pytest.mark.asyncio
async def test_on_internal_market_operation_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        97346870,
        97346880,
        lambda bot, _chain, got, on_error, on_complete: bot.on_internal_market_operation().subscribe(
            on_next=got.append, on_error=on_error, on_complete=on_complete
        ),
    )

    operations = _market_operations(notes)
    assert len(operations) >= 4
    assert all({"cancel", "owner", "order_id"} <= operation.keys() for operation in operations)


@pytest.mark.asyncio
async def test_on_exchange_transfer_operations_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        97346915,
        97346930,
        lambda bot, _chain, got, on_error, on_complete: bot.on_exchange_transfer().subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    operations = _exchange_operations(notes)
    assert len(operations) >= 4
    assert all(operation["exchange"] in set(Exchange) for operation in operations)


@pytest.mark.asyncio
async def test_on_exchange_transfer_to_exchange_account_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        97346930,
        97346940,
        lambda bot, _chain, got, on_error, on_complete: bot.on_exchange_transfer().subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    transfers = [
        f"Exchange transfer operation: {operation['from']} -> {operation['to']} - {_amount_value(operation['amount'])} HIVE"
        for operation in _exchange_operations(notes)
    ]
    assert transfers == ["Exchange transfer operation: inhivepool -> mxchive - 43120 HIVE"]


@pytest.mark.asyncio
async def test_on_whale_alert_large_transfers_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    threshold = _hive_threshold(50)
    notes = await mirrornet_replay(
        97347570,
        97347585,
        lambda bot, _chain, got, on_error, on_complete: bot.on_whale_alert(threshold).subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    operations = _whale_operations(notes)
    assert [f"Whale alert: {operation['from']} -> {operation['to']} - {_amount_value(operation['amount'])}" for operation in operations] == [
        "Whale alert: reward.app -> tarazkp - 8",
        "Whale alert: reward.app -> jkramer - 7",
        "Whale alert: honey-swap -> luluwinda - 53308",
    ]
    assert all(str(_amount_value(operation["amount"])) > str(threshold["amount"]) for operation in operations)
