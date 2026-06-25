"""Mirrornet-backed provider integration tests matching TypeScript provider cases."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import TYPE_CHECKING

import pytest

from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.payloads import (
    AccountsPayload,
    BlockPayload,
    FeedPricePayload,
    ManabarPayload,
    PayloadBase,
    RcAccountsPayload,
    WitnessesPayload,
    has_payload,
)

if TYPE_CHECKING:
    from workerbee import WorkerBee
    from workerbee.chain_observers.payloads import ObserverNotification
    from workerbee.chain_observers.queen import QueenBee

_PROVIDER_TIMEOUT_SECS = 90.0
_ACCOUNT = "gtg"
_SECOND_ACCOUNT = "steemit"
_THIRD_ACCOUNT = "blocktrades"

type ProviderBuilder = Callable[["QueenBee"], "QueenBee"]
type ProviderReady = Callable[["ObserverNotification"], bool]


async def _collect_provider_note(
    workerbee: WorkerBee,
    build: ProviderBuilder,
    is_ready: ProviderReady,
) -> ObserverNotification:
    received: list[ObserverNotification] = []
    errors: list[BaseException] = []
    done = asyncio.Event()

    def on_next(note: ObserverNotification) -> None:
        if is_ready(note):
            received.append(note)
            done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = build(workerbee.observe.on_block()).subscribe(on_next=on_next, on_error=on_error)
    try:
        async with asyncio.timeout(_PROVIDER_TIMEOUT_SECS):
            await done.wait()
        if errors:
            raise errors[0]
    finally:
        subscription.close()

    assert received
    return received[0]


def _has_keys(*payloads: type[PayloadBase]) -> ProviderReady:
    def ready(note: ObserverNotification) -> bool:
        return all(has_payload(note, payload) for payload in payloads)

    return ready


@pytest.mark.asyncio
async def test_provide_witnesses_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_witnesses(_ACCOUNT),
        _has_keys(WitnessesPayload),
    )

    witness = note["witnesses"][_ACCOUNT]
    assert witness is not None
    assert witness["owner"] == _ACCOUNT
    assert witness["total_missed_blocks"] >= 0
    assert int(witness["last_confirmed_block_num"]) > 0


@pytest.mark.asyncio
async def test_provide_rc_accounts_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_rc_accounts(_ACCOUNT),
        _has_keys(RcAccountsPayload),
    )

    rc_account = note["rc_accounts"][_ACCOUNT]
    assert rc_account is not None
    assert rc_account["name"] == _ACCOUNT
    assert int(rc_account["rc_manabar"]["current_mana"]) >= 0


@pytest.mark.asyncio
async def test_provide_feed_price_data_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_feed_price_data(),
        _has_keys(FeedPricePayload),
    )

    feed_price = note["feed_price"]
    assert feed_price["current_median_history"] is not None
    assert feed_price["current_min_history"] is not None
    assert feed_price["current_max_history"] is not None
    assert feed_price["price_history"]


@pytest.mark.asyncio
async def test_provide_block_header_data_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_block_header_data(),
        _has_keys(BlockPayload),
    )

    block = note["block"]
    assert block["number"] > 0
    assert block["timestamp"] is not None
    assert block["witness"]


@pytest.mark.asyncio
async def test_provide_block_data_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_block_data(),
        _has_keys(BlockPayload),
    )

    block = note["block"]
    assert block["number"] > 0
    assert "transactions" in block
    assert "transactions_per_id" in block


@pytest.mark.asyncio
async def test_provide_accounts_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_accounts(_ACCOUNT),
        _has_keys(AccountsPayload),
    )

    account = note["accounts"][_ACCOUNT]
    assert account is not None
    assert account["name"] == _ACCOUNT


@pytest.mark.asyncio
async def test_provide_rc_manabar_data_on_mirrornet(workerbee: WorkerBee) -> None:
    """Mirror TS bot_providers: onBlock().provideManabarData(2, "gtg")."""
    received: list[ManabarPayload] = []
    errors: list[BaseException] = []
    done = asyncio.Event()

    def on_next(note: object) -> None:
        if has_payload(note, ManabarPayload) and note["manabar_data"].get("gtg", {}).get(ManabarType.RC) is not None:
            received.append(note)
            done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = (
        workerbee.observe.on_block()
        .provide_manabar_data(ManabarType.RC, "gtg")
        .subscribe(
            on_next=on_next,
            on_error=on_error,
        )
    )
    try:
        async with asyncio.timeout(_PROVIDER_TIMEOUT_SECS):
            await done.wait()
        if errors:
            raise errors[0]
    finally:
        subscription.close()

    reading = received[0]["manabar_data"]["gtg"][ManabarType.RC]
    assert reading["percent"] >= 0
    assert reading["max"] >= 0
    assert isinstance(reading["current_mana"], int)


@pytest.mark.asyncio
async def test_combines_witnesses_and_accounts_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_witnesses(_ACCOUNT).provide_accounts(_ACCOUNT),
        _has_keys(WitnessesPayload, AccountsPayload),
    )

    witness = note["witnesses"][_ACCOUNT]
    account = note["accounts"][_ACCOUNT]
    assert witness is not None
    assert account is not None
    assert witness["owner"] == _ACCOUNT
    assert account["name"] == _ACCOUNT


@pytest.mark.asyncio
async def test_combines_feed_price_and_block_header_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_feed_price_data().provide_block_header_data(),
        _has_keys(FeedPricePayload, BlockPayload),
    )

    assert note["feed_price"]["price_history"]
    assert note["block"]["number"] > 0
    assert note["block"]["witness"]


@pytest.mark.asyncio
async def test_combines_account_related_providers_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_accounts(_ACCOUNT).provide_rc_accounts(_ACCOUNT).provide_manabar_data(ManabarType.RC, _ACCOUNT),
        _has_keys(AccountsPayload, RcAccountsPayload, ManabarPayload),
    )

    account = note["accounts"][_ACCOUNT]
    rc_account = note["rc_accounts"][_ACCOUNT]
    manabar = note["manabar_data"][_ACCOUNT][ManabarType.RC]
    assert account is not None
    assert rc_account is not None
    assert account["name"] == _ACCOUNT
    assert rc_account["name"] == _ACCOUNT
    assert manabar["percent"] >= 0


@pytest.mark.asyncio
async def test_combines_block_data_with_feed_price_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_block_data().provide_feed_price_data(),
        _has_keys(BlockPayload, FeedPricePayload),
    )

    assert note["block"]["number"] > 0
    assert "transactions" in note["block"]
    assert note["feed_price"]["price_history"]


@pytest.mark.asyncio
async def test_combines_all_available_providers_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_witnesses(_ACCOUNT)
        .provide_accounts(_ACCOUNT)
        .provide_rc_accounts(_ACCOUNT)
        .provide_manabar_data(ManabarType.RC, _ACCOUNT)
        .provide_block_data()
        .provide_feed_price_data(),
        _has_keys(WitnessesPayload, AccountsPayload, RcAccountsPayload, ManabarPayload, BlockPayload, FeedPricePayload),
    )

    witness = note["witnesses"][_ACCOUNT]
    account = note["accounts"][_ACCOUNT]
    rc_account = note["rc_accounts"][_ACCOUNT]
    assert witness is not None
    assert account is not None
    assert rc_account is not None
    assert witness["owner"] == _ACCOUNT
    assert account["name"] == _ACCOUNT
    assert rc_account["name"] == _ACCOUNT
    assert note["manabar_data"][_ACCOUNT][ManabarType.RC]["percent"] >= 0
    assert note["block"]["number"] > 0
    assert note["feed_price"]["price_history"]


@pytest.mark.asyncio
async def test_combines_multiple_accounts_for_different_providers_on_mirrornet(workerbee: WorkerBee) -> None:
    note = await _collect_provider_note(
        workerbee,
        lambda queen: queen.provide_witnesses(_ACCOUNT, _SECOND_ACCOUNT)
        .provide_accounts(_ACCOUNT, _SECOND_ACCOUNT, _THIRD_ACCOUNT)
        .provide_rc_accounts(_ACCOUNT, _THIRD_ACCOUNT),
        _has_keys(WitnessesPayload, AccountsPayload, RcAccountsPayload),
    )

    assert note["witnesses"][_ACCOUNT] is not None
    assert note["witnesses"][_SECOND_ACCOUNT] is not None
    assert note["witnesses"][_ACCOUNT]["owner"] == _ACCOUNT
    assert note["witnesses"][_SECOND_ACCOUNT]["owner"] == _SECOND_ACCOUNT
    assert note["accounts"][_ACCOUNT] is not None
    assert note["accounts"][_SECOND_ACCOUNT] is not None
    assert note["accounts"][_THIRD_ACCOUNT] is not None
    assert note["accounts"][_ACCOUNT]["name"] == _ACCOUNT
    assert note["accounts"][_SECOND_ACCOUNT]["name"] == _SECOND_ACCOUNT
    assert note["accounts"][_THIRD_ACCOUNT]["name"] == _THIRD_ACCOUNT
    assert note["rc_accounts"][_ACCOUNT] is not None
    assert note["rc_accounts"][_THIRD_ACCOUNT] is not None
    assert note["rc_accounts"][_ACCOUNT]["name"] == _ACCOUNT
    assert note["rc_accounts"][_THIRD_ACCOUNT]["name"] == _THIRD_ACCOUNT
