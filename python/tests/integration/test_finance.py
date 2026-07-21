"""Mirrornet-backed integration tests for finance and market observer hooks."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from tests.integration._asset_assertions import asset_amount_value, hive_threshold, ts_raw_asset_is_greater_than
from tests.integration._mirrornet import MirrornetReplay
from workerbee.chain_observers.enums import Exchange

if TYPE_CHECKING:
    from workerbee.chain_observers.payloads import ExchangeTransferMetadata, InternalMarketOperation, ObserverNotification, WhaleAlertMetadata


def _market_operations(notes: list[ObserverNotification]) -> list[InternalMarketOperation]:
    return [pair["operation"] for note in notes for pair in note.get("internal_market_operations", [])]


def _exchange_operations(notes: list[ObserverNotification]) -> list[ExchangeTransferMetadata]:
    return [pair["operation"] for note in notes for pair in note.get("exchange_transfer_operations", [])]


def _whale_operations(notes: list[ObserverNotification]) -> list[WhaleAlertMetadata]:
    return [pair["operation"] for note in notes for pair in note.get("whale_operations", [])]


@pytest.mark.asyncio
async def test_on_internal_market_operation_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes: list[ObserverNotification] = await mirrornet_replay(
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
    notes: list[ObserverNotification] = await mirrornet_replay(
        97346915,
        97346930,
        lambda bot, _chain, got, on_error, on_complete: bot.on_exchange_transfer().subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    operations = _exchange_operations(notes)
    assert len(operations) >= 4
    assert all(operation["exchange"] in set(Exchange) for operation in operations)


@pytest.mark.asyncio
async def test_on_exchange_transfer_to_exchange_account_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes: list[ObserverNotification] = await mirrornet_replay(
        97346930,
        97346940,
        lambda bot, _chain, got, on_error, on_complete: bot.on_exchange_transfer().subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    transfers = [
        f"Exchange transfer operation: {operation['from']} -> {operation['to']} - {asset_amount_value(operation['amount'])} HIVE"
        for operation in _exchange_operations(notes)
    ]
    assert transfers == ["Exchange transfer operation: inhivepool -> mxchive - 43120 HIVE"]


@pytest.mark.asyncio
async def test_on_whale_alert_uses_ts_raw_asset_ordering_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    threshold = hive_threshold(50)
    notes: list[ObserverNotification] = await mirrornet_replay(
        97347570,
        97347585,
        lambda bot, _chain, got, on_error, on_complete: bot.on_whale_alert(threshold).subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    operations = _whale_operations(notes)
    assert [f"Whale alert: {operation['from']} -> {operation['to']} - {asset_amount_value(operation['amount'])}" for operation in operations] == [
        "Whale alert: reward.app -> tarazkp - 8",
        "Whale alert: reward.app -> jkramer - 7",
        "Whale alert: honey-swap -> luluwinda - 53308",
    ]
    assert all(ts_raw_asset_is_greater_than(threshold, operation["amount"]) for operation in operations)
