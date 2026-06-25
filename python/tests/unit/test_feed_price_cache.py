"""Tests for FeedPriceCollector caching and interval logic."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import ClassVar

import pytest

from workerbee.chain_observers.classifiers.dynamic_global_properties_classifier import (
    DynamicGlobalPropertiesClassifier,
)
from workerbee.chain_observers.collectors.jsonrpc.feed_price_collector import (
    FeedPriceCollector,
    _is_divisible_by_in_range,
)


class TestIsDivisibleByInRange:
    @pytest.mark.parametrize(
        ("interval", "start", "end", "expected"),
        [
            pytest.param(1200, 1000, 1200, True, id="boundary-within-range"),
            pytest.param(1200, 1201, 2399, False, id="boundary-before-start"),
            pytest.param(1200, 0, 100, True, id="boundary-at-start"),
            pytest.param(1200, 100, 200, False, id="no-boundary-in-range"),
            pytest.param(1200, 1000, 3600, True, id="multiple-boundaries"),
            pytest.param(1200, 1200, 1200, True, id="start-equals-end"),
            pytest.param(1200, 1199, 1199, False, id="start-equals-end-not-boundary"),
            pytest.param(1200, 50000, 51200, True, id="large-interval"),
        ],
    )
    def test_detects_interval_boundary(self, interval: int, start: int, end: int, expected: bool) -> None:
        assert _is_divisible_by_in_range(interval, start, end) is expected


class FakeFeedHistoryResult:
    def __init__(self) -> None:
        self.price_history = [{"base": "0.300 HBD", "quote": "1.000 HIVE"}]
        self.current_median_history = {"base": "0.300 HBD", "quote": "1.000 HIVE"}
        self.current_min_history = {"base": "0.290 HBD", "quote": "1.000 HIVE"}
        self.current_max_history = {"base": "0.310 HBD", "quote": "1.000 HIVE"}
        self.market_median_history = {"base": "0.305 HBD", "quote": "1.000 HIVE"}


class FakeChainForFeed:
    endpoint_url = "https://fake.api/"
    config: ClassVar[dict[str, str]] = {"HIVE_FEED_INTERVAL_BLOCKS": "1200"}

    def __init__(self) -> None:
        self.call_count = 0

    class _DatabaseApi:
        def __init__(self, chain: FakeChainForFeed) -> None:
            self._chain = chain

        async def get_feed_history(self) -> FakeFeedHistoryResult:
            self._chain.call_count += 1
            return FakeFeedHistoryResult()

    @property
    def api(self) -> _FakeApi:
        return _FakeApi(self)


class _FakeApi:
    def __init__(self, chain: FakeChainForFeed) -> None:
        self.database_api = FakeChainForFeed._DatabaseApi(chain)


class FakeWorkerForFeed:
    def __init__(self) -> None:
        self.chain = FakeChainForFeed()


class FakeDEC:
    def __init__(self) -> None:
        self._timings: list[tuple[str, float]] = []
        self._head_block = 1000

    async def get(self, classifier_cls: type) -> dict[str, object]:
        return {"head_block_number": self._head_block}

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        try:
            yield
        finally:
            self._timings.append((name, 0.0))


class TestFeedPriceCollectorCaching:
    @pytest.mark.asyncio
    async def test_first_call_always_fetches(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1000

        result = await collector.get(dec)
        assert worker.chain.call_count == 1
        assert "FeedPriceClassifier" in result

    @pytest.mark.asyncio
    async def test_same_block_returns_cached(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1000

        await collector.get(dec)
        await collector.get(dec)
        assert worker.chain.call_count == 1

    @pytest.mark.asyncio
    async def test_next_block_no_boundary_returns_cached(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1000

        await collector.get(dec)

        dec._head_block = 1001
        await collector.get(dec)
        assert worker.chain.call_count == 1

    @pytest.mark.asyncio
    async def test_boundary_crossed_refetches(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1000

        await collector.get(dec)
        assert worker.chain.call_count == 1

        dec._head_block = 1200
        await collector.get(dec)
        assert worker.chain.call_count == 2

    @pytest.mark.asyncio
    async def test_uses_chain_feed_interval_config(self) -> None:
        worker = FakeWorkerForFeed()
        worker.chain.config = {"HIVE_FEED_INTERVAL_BLOCKS": "20"}
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 10

        await collector.get(dec)

        dec._head_block = 19
        await collector.get(dec)
        assert worker.chain.call_count == 1

        dec._head_block = 20
        await collector.get(dec)
        assert worker.chain.call_count == 2

    @pytest.mark.asyncio
    async def test_many_blocks_no_boundary(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1201

        await collector.get(dec)

        for block in range(1202, 2399):
            dec._head_block = block
            await collector.get(dec)

        assert worker.chain.call_count == 1

    @pytest.mark.asyncio
    async def test_many_blocks_with_boundary(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1201

        await collector.get(dec)

        dec._head_block = 2400
        await collector.get(dec)

        assert worker.chain.call_count == 2

    @pytest.mark.asyncio
    async def test_cached_content_matches_fresh(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        dec = FakeDEC()
        dec._head_block = 1000

        first = await collector.get(dec)
        second = await collector.get(dec)

        assert worker.chain.call_count == 1
        feed_first = first["FeedPriceClassifier"]
        feed_second = second["FeedPriceClassifier"]
        assert feed_first["current_median_history"] == feed_second["current_median_history"]
        assert feed_first["price_history"] == feed_second["price_history"]

    @pytest.mark.asyncio
    async def test_used_contexts_includes_dgp(self) -> None:
        worker = FakeWorkerForFeed()
        collector = FeedPriceCollector(worker)
        assert DynamicGlobalPropertiesClassifier in collector.used_contexts()

    @pytest.mark.asyncio
    async def test_no_state_leak_between_instances(self) -> None:
        worker1 = FakeWorkerForFeed()
        worker2 = FakeWorkerForFeed()
        c1 = FeedPriceCollector(worker1)
        c2 = FeedPriceCollector(worker2)
        dec = FakeDEC()
        dec._head_block = 1000

        await c1.get(dec)
        await c2.get(dec)

        assert worker1.chain.call_count == 1
        assert worker2.chain.call_count == 1
