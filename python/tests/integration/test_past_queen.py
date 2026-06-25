"""Mirrornet integration tests for WorkerBee historical replay."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import pytest

from tests.integration._mirrornet import MirrornetReplay
from workerbee import WorkerBee
from workerbee.chain_observers.errors import WorkerBeeError
from workerbee.chain_observers.factories.historydata.factory import HistoryDataFactory

if TYPE_CHECKING:
    from workerbee.chain_observers.payloads import ObserverNotification

_LIVE_TIMEOUT_SECS = 90.0
_SAMPLE_BLOCK = 96_549_390
_SAMPLE_TRANSACTION_ID = "95facd1b34b768f7974bda08387e6b2dfea38540"


def _append_block_number(payload: ObserverNotification, numbers: list[int]) -> None:
    number = payload["block"]["number"]
    assert isinstance(number, int)
    numbers.append(number)


@pytest.mark.asyncio
async def test_provide_past_operations_replays_historical_range(mirrornet_replay: MirrornetReplay) -> None:
    """A closed [from, to] mirrornet range replays the historical operations in it."""

    def append_posts(payload: ObserverNotification, content: list[str]) -> None:
        for entries in payload.get("posts", {}).values():
            for pair in entries:
                operation = pair["operation"]
                content.append(f"{operation['author']}:{operation['permlink']}")

    result = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("mtyszczak")
        .on_posts("nickdongsik")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: append_posts(payload, content),
        ),
    )

    assert result == [
        "mtyszczak:hi-ve-everyone",
        "nickdongsik:yay-hb1hao",
    ]


@pytest.mark.asyncio
async def test_provide_past_operations_reports_negative_block_range(mirrornet_replay: MirrornetReplay) -> None:
    """Invalid negative historical ranges are reported through the observer error path."""
    with pytest.raises(WorkerBeeError, match="No blocks returned"):
        await mirrornet_replay(
            -1,
            -1,
            lambda replay, _chain, received, on_error, on_complete: replay.on_block().subscribe(
                on_next=received.append,
                on_error=on_error,
                on_complete=on_complete,
            ),
        )


@pytest.mark.asyncio
async def test_provide_past_operations_reports_future_block_range(mirrornet_replay: MirrornetReplay) -> None:
    """Far-future historical ranges are reported through the observer error path."""
    with pytest.raises(WorkerBeeError, match="No blocks returned"):
        await mirrornet_replay(
            2_147_482_640,
            2_147_483_640,
            lambda replay, _chain, received, on_error, on_complete: replay.on_block().subscribe(
                on_next=received.append,
                on_error=on_error,
                on_complete=on_complete,
            ),
        )


@pytest.mark.asyncio
async def test_provide_past_operations_replays_exact_inclusive_block_count(mirrornet_replay: MirrornetReplay) -> None:
    """A closed historical block range emits exactly one block payload per block."""
    block_numbers = await mirrornet_replay(
        _SAMPLE_BLOCK,
        _SAMPLE_BLOCK + 3,
        lambda replay, _chain, received, on_error, on_complete: replay.on_block()
        .provide_block_header_data()
        .subscribe(
            on_next=lambda payload: _append_block_number(payload, received),
            on_error=on_error,
            on_complete=on_complete,
        ),
    )

    assert block_numbers == [_SAMPLE_BLOCK, _SAMPLE_BLOCK + 1, _SAMPLE_BLOCK + 2, _SAMPLE_BLOCK + 3]


@pytest.mark.asyncio
async def test_provide_past_operations_replays_transaction_id(mirrornet_replay: MirrornetReplay) -> None:
    """Historical transaction-id observers emit the matching transaction payload."""
    got = await mirrornet_replay(
        _SAMPLE_BLOCK,
        _SAMPLE_BLOCK,
        lambda replay, _chain, received, on_error, on_complete: replay.on_transaction_ids(_SAMPLE_TRANSACTION_ID)
        .provide_block_header_data()
        .subscribe(on_next=received.append, on_error=on_error, on_complete=on_complete),
    )

    assert len(got) == 1
    assert got[0]["block"]["number"] == _SAMPLE_BLOCK
    assert _SAMPLE_TRANSACTION_ID in got[0]["transactions"]


@pytest.mark.asyncio
async def test_provide_past_operations_replays_more_than_one_fetch_batch(mirrornet_replay: MirrornetReplay) -> None:
    """Historical replay continues past the 1000-block RPC fetch boundary."""
    first_block = 500_017
    last_block = 501_020
    block_numbers = await mirrornet_replay(
        first_block,
        last_block,
        lambda replay, _chain, received, on_error, on_complete: replay.on_block().subscribe(
            on_next=lambda payload: _append_block_number(payload, received),
            on_error=on_error,
            on_complete=on_complete,
        ),
    )

    assert len(block_numbers) == 1_004
    assert block_numbers[0] == first_block
    assert block_numbers[-1] == last_block


@pytest.mark.asyncio
async def test_provide_past_operations_relative_replays_recent_window(inactive_workerbee: WorkerBee) -> None:
    """A relative mirrornet window resolves a positive start block and replays data."""
    received: list[ObserverNotification] = []
    errors: list[BaseException] = []
    done = asyncio.Event()

    past_queen = await inactive_workerbee.provide_past_operations_relative("-30s")
    creation_head = int((await inactive_workerbee.chain.api.database_api.get_dynamic_global_properties()).head_block_number)
    factory = past_queen.mediator._factory
    assert isinstance(factory, HistoryDataFactory)
    assert factory.from_block > 0
    assert factory.to_block is None
    assert factory.from_block <= creation_head

    def on_next(payload: ObserverNotification) -> None:
        received.append(payload)
        done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = past_queen.on_block().subscribe(
        on_next=on_next,
        on_error=on_error,
    )
    try:
        async with asyncio.timeout(_LIVE_TIMEOUT_SECS):
            await done.wait()
        if errors:
            raise errors[0]
    finally:
        subscription.close()

    block_number = received[0]["block"]["number"]
    assert isinstance(block_number, int)
    assert factory.from_block <= block_number <= creation_head
