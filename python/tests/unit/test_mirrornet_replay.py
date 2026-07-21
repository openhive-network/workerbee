"""Unit checks for mirrornet replay test helpers."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import ClassVar, cast

import pytest

import tests.integration._mirrornet as mirrornet_module
from tests.integration._mirrornet import MirrornetReplay
from workerbee.chain_observers.interfaces import CompleteCallback, ErrorCallback
from workerbee.chain_observers.past_queen import PastQueen
from workerbee.chain_observers.queen import Subscription


class _FakeWorkerBee:
    closed_count: ClassVar[int] = 0
    chain = object()

    def __init__(self, _chain: object) -> None:
        pass

    async def __aenter__(self) -> _FakeWorkerBee:
        raise AssertionError("historical mirrornet replay must not start live polling")

    async def __aexit__(self, *_args: object) -> None:
        await self.aclose()

    def provide_past_operations(self, _from_block: int, _to_block: int) -> PastQueen:
        return cast("PastQueen", object())

    async def aclose(self) -> None:
        type(self).closed_count += 1


class _FakeSubscription:
    def close(self) -> None:
        raise AssertionError("completed replay subscriptions should not be closed twice")


@pytest.mark.asyncio
async def test_mirrornet_replay_uses_inactive_workerbee(monkeypatch: pytest.MonkeyPatch) -> None:
    @asynccontextmanager
    async def fake_open_mirrornet_chain(_endpoint: str) -> AsyncIterator[object]:
        yield object()

    def register(
        _replay: PastQueen,
        _chain: object,
        results: list[str],
        _on_error: ErrorCallback,
        on_complete: CompleteCallback,
    ) -> Subscription:
        results.append("complete")
        on_complete()
        return cast("Subscription", _FakeSubscription())

    monkeypatch.setattr(mirrornet_module, "open_mirrornet_chain", fake_open_mirrornet_chain)
    monkeypatch.setattr(mirrornet_module, "WorkerBee", _FakeWorkerBee)

    result = await MirrornetReplay("https://example.invalid")(1, 1, register)

    assert result == ["complete"]
    assert _FakeWorkerBee.closed_count == 1
