"""Mirrornet integration tests for ``Subscription`` and filter composition."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

import pytest

from tests.integration._mirrornet import MirrornetReplay
from workerbee import DataEvaluationContext, WorkerBee

if TYPE_CHECKING:
    from workerbee.chain_observers.payloads import ObserverNotification
    from workerbee.chain_observers.queen import QueenBee

TIMEOUT_SECS = 90.0


async def _collect_first(queen: QueenBee) -> ObserverNotification:
    received: list[ObserverNotification] = []
    errors: list[BaseException] = []
    done = asyncio.Event()

    def on_next(payload: ObserverNotification) -> None:
        received.append(payload)
        done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = queen.subscribe(on_next=on_next, on_error=on_error)
    try:
        async with asyncio.timeout(TIMEOUT_SECS):
            await done.wait()
        if errors:
            raise errors[0]
        return received[0]
    finally:
        subscription.close()


def _append_posts(payload: dict[str, Any], content: list[str]) -> None:
    for entries in payload.get("posts", {}).values():
        for pair in entries:
            operation = pair["operation"]
            block = payload.get("block", {})
            content.append(f"Post by {operation['author']}: {operation['permlink']} in block {block.get('number')}")


def _append_votes(payload: dict[str, Any], content: list[str]) -> None:
    for entries in payload.get("votes", {}).values():
        for pair in entries:
            operation = pair["operation"]
            block = payload.get("block", {})
            content.append(f"Vote by {operation['voter']}: {operation['permlink']} in block {block.get('number')}")


@pytest.mark.asyncio
async def test_subscribe_on_next_delivers_notification(workerbee: WorkerBee) -> None:
    """A basic ``on_block`` hook delivers an ``ObserverNotification``."""
    notification = await _collect_first(workerbee.observe.on_block())

    block = notification["block"]
    assert isinstance(block, dict)
    assert isinstance(block["number"], int)


@pytest.mark.asyncio
async def test_and_emits_only_when_both_match_on_mirrornet_replay(mirrornet_replay: MirrornetReplay) -> None:
    """``on_posts(...).and_.on_votes(...)`` fires only for a block with both."""

    def append_content(payload: dict[str, Any], content: list[str]) -> None:
        _append_posts(payload, content)
        _append_votes(payload, content)

    result = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("mtyszczak")
        .and_.on_votes("jacor")
        .provide_block_data()
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: append_content(payload, content),
        ),
    )

    assert result == [
        "Post by mtyszczak: hi-ve-everyone in block 96549402",
        "Vote by jacor: i-went-to-a-doctors-office-my-vision-is-improving-eng-esp in block 96549402",
    ]


@pytest.mark.asyncio
async def test_or_emits_for_either_branch_on_mirrornet_replay(mirrornet_replay: MirrornetReplay) -> None:
    """``on_posts(alice).OR.on_posts(bob)`` provides either named branch."""

    def append_post_authors(payload: dict[str, Any], content: list[str]) -> None:
        for author, entries in payload.get("posts", {}).items():
            if entries:
                content.append(author)

    result = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("mtyszczak")
        .OR.on_posts("nickdongsik")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: append_post_authors(payload, content),
        ),
    )

    assert result == ["mtyszczak", "nickdongsik"]


@pytest.mark.asyncio
async def test_on_complete_fires_on_close(workerbee: WorkerBee) -> None:
    """``on_complete`` fires when the subscription is closed."""
    completed: list[bool] = []
    subscription = workerbee.observe.on_block().subscribe(
        on_next=lambda _data: None,
        on_complete=lambda: completed.append(True),
    )
    assert completed == []
    subscription.close()
    assert completed == [True]


@pytest.mark.asyncio
async def test_on_error_receives_pipeline_error_not_on_next(workerbee: WorkerBee) -> None:
    """A provider raising routes the error to ``on_error``, never to ``on_next``."""
    errors: list[BaseException] = []
    next_calls: list[object] = []
    done = asyncio.Event()

    def boom(_data: DataEvaluationContext) -> dict[str, object]:
        raise ValueError("boom from provider")

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = (
        workerbee.observe.on_block()
        .provide(boom)
        .subscribe(
            on_next=next_calls.append,
            on_error=on_error,
        )
    )
    try:
        async with asyncio.timeout(TIMEOUT_SECS):
            await done.wait()
    finally:
        subscription.close()

    assert next_calls == []
    assert isinstance(errors[0], ValueError)
    assert "boom from provider" in str(errors[0])


@pytest.mark.asyncio
async def test_close_stops_further_on_next(workerbee: WorkerBee) -> None:
    """After ``sub.close()`` no further matching block triggers ``on_next``."""
    got: list[ObserverNotification] = []
    done = asyncio.Event()

    def on_next(payload: ObserverNotification) -> None:
        got.append(payload)
        done.set()

    subscription = workerbee.observe.on_block().subscribe(
        on_next=on_next,
    )
    async with asyncio.timeout(TIMEOUT_SECS):
        await done.wait()
    subscription.close()
    seen_at_close = len(got)
    await asyncio.sleep(5.0)

    assert len(got) == seen_at_close
