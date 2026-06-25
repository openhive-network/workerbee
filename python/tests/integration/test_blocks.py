"""Mirrornet-backed integration tests for block/transaction observer hooks."""

from __future__ import annotations

import pytest

from tests.integration._mirrornet import MirrornetReplay

SAMPLE_BLOCK = 96_549_390
SAMPLE_TRANSACTION_ID = "95facd1b34b768f7974bda08387e6b2dfea38540"


@pytest.mark.asyncio
async def test_on_block(mirrornet_replay: MirrornetReplay) -> None:
    got = await mirrornet_replay(
        SAMPLE_BLOCK,
        SAMPLE_BLOCK,
        lambda replay, _chain, received, on_error, on_complete: replay.on_block().subscribe(
            on_next=received.append, on_error=on_error, on_complete=on_complete
        ),
    )

    # on_block() registers BlockHeaderProvider, which injects the "block" key
    # carrying the header (number / witness): assert the delivered payload, not
    # just that something was emitted.
    block = got[0]["block"]
    assert isinstance(block["number"], int)
    assert block["number"] == SAMPLE_BLOCK
    assert "witness" in block
    assert isinstance(block["witness"], str) and block["witness"]


@pytest.mark.asyncio
async def test_on_block_number(mirrornet_replay: MirrornetReplay) -> None:
    got = await mirrornet_replay(
        SAMPLE_BLOCK,
        SAMPLE_BLOCK,
        lambda replay, _chain, received, on_error, on_complete: replay.on_block_number(SAMPLE_BLOCK)
        .provide_block_header_data()
        .subscribe(on_next=received.append, on_error=on_error, on_complete=on_complete),
    )

    assert got[0]["block"]["number"] == SAMPLE_BLOCK


@pytest.mark.asyncio
async def test_on_transaction_ids(mirrornet_replay: MirrornetReplay) -> None:
    got = await mirrornet_replay(
        SAMPLE_BLOCK,
        SAMPLE_BLOCK,
        lambda replay, _chain, received, on_error, on_complete: replay.on_transaction_ids(SAMPLE_TRANSACTION_ID).subscribe(
            on_next=received.append,
            on_error=on_error,
            on_complete=on_complete,
        ),
    )

    # TransactionByIdProvider keys the "transactions" dict by id: assert our
    # exact historical tx actually landed in the delivered payload.
    assert SAMPLE_TRANSACTION_ID in got[0]["transactions"]
