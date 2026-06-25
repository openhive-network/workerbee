"""Tests for PastQueen historical replay lifecycle."""

from __future__ import annotations

import asyncio

import pytest

from workerbee.chain_observers.errors import WorkerBeeError
from workerbee.chain_observers.factories.historydata.factory import HistoryDataFactory
from workerbee.chain_observers.past_queen import PastQueen
from workerbee.chain_observers.queen import QueenBee


class FakeFactory:
    def __init__(self) -> None:
        self.extended_from: list[object] = []

    def extend(self, other: object) -> None:
        self.extended_from.append(other)

    def collect(self) -> object:
        return None

    def push_classifier(self, *args: object) -> None:
        pass

    def pop_classifier(self, *args: object) -> None:
        pass


class FakeMediator:
    def __init__(self) -> None:
        self._filters: dict[object, object] = {}
        self._factory = FakeFactory()
        self.extended_from: list[object] = []
        self.unregistered: list[object] = []

    def extend(self, other: object) -> None:
        self.extended_from.append(other)
        for entry in getattr(other, "_filters", {}).values():
            self._filters[id(entry.listener)] = entry.listener

    def register_listener(self, listener: object, filt: object, providers: object) -> None:
        self._filters[id(listener)] = listener

    def unregister_listener(self, listener: object) -> None:
        self.unregistered.append(listener)
        self._filters.pop(id(listener), None)
        complete = getattr(listener, "complete", None)
        if complete is not None:
            complete()


class FakeChainForPQ:
    endpoint_url = "https://fake.api/"


class FakeWorkerForPastQueen:
    def __init__(self) -> None:
        self.chain = FakeChainForPQ()
        self.mediator = FakeMediator()


_UNSUPPORTED_PAST_QUEEN_METHODS: tuple[tuple[str, tuple[object, ...]], ...] = (
    ("on_accounts_full_manabar", (1, "alice")),
    ("on_accounts_manabar_percent", (1, 50, "alice")),
    ("provide_manabar_data", (1, "alice")),
    ("on_accounts_balance_change", (False, "alice")),
    ("on_accounts_metadata_change", ("alice",)),
    ("provide_accounts", ("alice",)),
    ("on_feed_price_change", (5,)),
    ("on_feed_price_no_change", (24,)),
    ("provide_feed_price_data", ()),
    ("on_alarm", ("alice",)),
    ("on_witnesses_missed_blocks", (1, "alice")),
    ("provide_witnesses", ("alice",)),
    ("provide_rc_accounts", ("alice",)),
)


class TestPastQueenTransition:
    def test_creates_own_mediator_distinct_from_worker(self) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 1000, 1005)
        assert pq.mediator is not worker.mediator
        assert isinstance(pq, QueenBee)

    def test_stores_block_range_in_factory(self) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 1000, 1005)
        factory = pq.mediator._factory
        assert factory.from_block == 1000
        assert factory.to_block == 1005

    def test_to_block_none_creates_open_ended_range(self) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 500, None)
        factory = pq.mediator._factory
        assert factory.from_block == 500
        assert factory.to_block is None

    @pytest.mark.asyncio
    async def test_subscription_close_extends_worker_mediator_like_ts_past_queen(self) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 1000, 1005)

        async def notify() -> None:
            pass

        pq.mediator.notify = notify
        subscription = pq.on_block().subscribe()
        subscription.close()

        assert worker.mediator.extended_from == [pq.mediator]

    @pytest.mark.asyncio
    async def test_replay_exhaustion_completes_history_subscription_without_live_handoff(self) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 1000, 1005)
        completed = False

        async def notify() -> None:
            pass

        async def on_complete() -> None:
            nonlocal completed
            completed = True

        pq.mediator.notify = notify
        pq.on_block().subscribe(on_complete=on_complete)
        factory = pq.mediator._factory
        assert isinstance(factory, HistoryDataFactory)
        factory._current_block_number = 1005

        await factory.post_notify(None, pq.mediator)

        assert completed is True
        assert not pq.mediator.has_listeners
        assert worker.mediator._filters == {}
        assert worker.mediator.extended_from == []

    @pytest.mark.asyncio
    async def test_history_factory_post_notify_does_not_schedule_without_listeners(self) -> None:
        worker = FakeWorkerForPastQueen()
        factory = HistoryDataFactory(worker, 1000, None)
        factory._current_block_number = 1000
        notified: list[bool] = []

        class _NoListenerMediator:
            def __init__(self) -> None:
                self._filters: dict[object, object] = {}

            @property
            def has_listeners(self) -> bool:
                return False

            async def notify(self) -> None:
                notified.append(True)

        await factory.post_notify(None, _NoListenerMediator())
        await asyncio.sleep(0)

        assert factory._notify_task is None
        assert notified == []

    @pytest.mark.asyncio
    async def test_on_subscribe_triggers_notify(self) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 1000, 1005)
        notified: list[bool] = []

        async def fake_notify() -> None:
            notified.append(True)

        pq.mediator.notify = fake_notify
        pq.on_subscribe()
        await asyncio.sleep(0.02)
        assert len(notified) == 1

    @pytest.mark.parametrize(("method_name", "args"), _UNSUPPORTED_PAST_QUEEN_METHODS)
    def test_live_only_methods_are_rejected_like_ts_past_queen(self, method_name: str, args: tuple[object, ...]) -> None:
        worker = FakeWorkerForPastQueen()
        pq = PastQueen(worker, 1000, 1005)

        method = getattr(pq, method_name)
        with pytest.raises(WorkerBeeError, match=f"{method_name}.*PastQueen"):
            method(*args)
