"""Public error behavior for the JSON-RPC ``BlockCollector``.

The tests drive the collector through a fake block API. That keeps the same
public seam as the live observer path without starting a dedicated chain.
"""

from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, cast

import pytest
from msgspec import UNSET

from workerbee.chain_observers.classifiers.dynamic_global_properties_classifier import (
    DynamicGlobalPropertiesClassifier,
)
from workerbee.chain_observers.collectors.jsonrpc.block_collector import (
    MAX_BLOCK_RANGE_FETCH,
    BlockCollector,
)
from workerbee.chain_observers.errors import BlockNotAvailableError, WorkerBeeError

if TYPE_CHECKING:
    from collections.abc import Iterator

    from workerbee.chain_observers.classifiers.collector_classifier_base import (
        CollectorClassifierBase,
    )
    from workerbee.chain_observers.interfaces import IWorkerBee


class _StubCollectorContext:
    """Minimal collector context that hands ``BlockCollector`` a fixed head."""

    def __init__(self, head_block_number: int) -> None:
        self._head_block_number = head_block_number

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        yield

    async def get(self, classifier: type[CollectorClassifierBase]) -> dict[str, int]:
        assert classifier is DynamicGlobalPropertiesClassifier
        return {"head_block_number": self._head_block_number}

    async def query(self, classifier: type[CollectorClassifierBase], options: Any) -> Any:
        raise AssertionError("BlockCollector.get must not call query")


class _FakeBlockApi:
    def __init__(self, *, missing_block: int | None = None) -> None:
        self._missing_block = missing_block
        self.block_calls: list[int] = []
        self.range_calls: list[tuple[int, int]] = []

    async def get_block(self, *, block_num: int) -> SimpleNamespace:
        self.block_calls.append(block_num)
        if block_num == self._missing_block:
            return SimpleNamespace(block=UNSET)
        return SimpleNamespace(
            block=SimpleNamespace(
                transactions=[],
                transaction_ids=[],
            ),
        )

    async def get_block_range(self, *, starting_block_num: int, count: int) -> SimpleNamespace:
        self.range_calls.append((starting_block_num, count))
        return SimpleNamespace(blocks=[])


class _BlockCollectorWorker:
    def __init__(self, block_api: _FakeBlockApi) -> None:
        self.chain = SimpleNamespace(api=SimpleNamespace(block_api=block_api))


def _collector(block_api: _FakeBlockApi) -> BlockCollector:
    return BlockCollector(cast("IWorkerBee", _BlockCollectorWorker(block_api)))


@pytest.mark.asyncio
async def test_block_not_available_error_for_missing_block() -> None:
    unavailable_block = 10_000_000
    block_api = _FakeBlockApi(missing_block=unavailable_block)
    collector = _collector(block_api)

    with pytest.raises(BlockNotAvailableError) as exc_info:
        await collector.get(_StubCollectorContext(unavailable_block))

    assert block_api.block_calls == [unavailable_block]
    assert block_api.range_calls == []
    assert isinstance(exc_info.value, WorkerBeeError)
    assert exc_info.value.block_number == unavailable_block
    assert str(unavailable_block) in str(exc_info.value)


@pytest.mark.asyncio
async def test_worker_bee_error_when_catch_up_gap_exceeds_max_range() -> None:
    block_api = _FakeBlockApi()
    collector = _collector(block_api)

    await collector.get(_StubCollectorContext(1))

    far_head = MAX_BLOCK_RANGE_FETCH + 3
    with pytest.raises(WorkerBeeError) as exc_info:
        await collector.get(_StubCollectorContext(far_head))

    assert block_api.block_calls == [1]
    assert block_api.range_calls == []
    assert not isinstance(exc_info.value, BlockNotAvailableError)
    assert "Cannot catch up block range larger than" in str(exc_info.value)
    assert str(MAX_BLOCK_RANGE_FETCH) in str(exc_info.value)
