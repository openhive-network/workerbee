"""Tests for the Factory -> Collector -> DEC -> Filter -> Provider -> Mediator pipeline."""

from __future__ import annotations

import asyncio
from types import MappingProxyType
from typing import Any

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.block_classifier import BlockClassifier
from workerbee.chain_observers.classifiers.block_header_classifier import BlockHeaderClassifier
from workerbee.chain_observers.classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from workerbee.chain_observers.classifiers.collector_classifier_base import CollectorClassifierBase
from workerbee.chain_observers.classifiers.content_metadata_classifier import ContentMetadataClassifier
from workerbee.chain_observers.classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from workerbee.chain_observers.classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from workerbee.chain_observers.classifiers.feed_price_classifier import FeedPriceClassifier
from workerbee.chain_observers.classifiers.impacted_account_classifier import ImpactedAccountClassifier
from workerbee.chain_observers.classifiers.manabar_classifier import ManabarClassifier
from workerbee.chain_observers.classifiers.operation_classifier import OperationClassifier
from workerbee.chain_observers.classifiers.rc_account_classifier import RcAccountClassifier
from workerbee.chain_observers.classifiers.witness_classifier import WitnessClassifier
from workerbee.chain_observers.collectors.collector_base import CollectorBase
from workerbee.chain_observers.factories.data_evaluation_context import DataEvaluationContext
from workerbee.chain_observers.factories.factory_base import EClassifierOrigin, FactoryBase
from workerbee.chain_observers.factories.historydata.factory import HistoryDataFactory
from workerbee.chain_observers.factories.jsonrpc.factory import JsonRpcFactory
from workerbee.chain_observers.filters.filter_base import FilterBase
from workerbee.chain_observers.interfaces import Observer
from workerbee.chain_observers.observer_mediator import ObserverMediator
from workerbee.chain_observers.providers.provider_base import ProviderBase

from .conftest import FakeWorker

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _StubCollector(CollectorBase):
    """Minimal collector that returns a fixed dict from get()."""

    def __init__(self, data: dict[str, Any]) -> None:
        # Bypass the worker param from CollectorBase.__init__
        super().__init__(worker=None)
        self._data = data

    async def get(self, data: Any) -> dict[str, Any]:
        return self._data


class _StubClassifier(CollectorClassifierBase):
    pass


class _StubClassifier2(CollectorClassifierBase):
    pass


class _AlwaysTrueFilter(FilterBase):
    async def match(self, data: Any) -> bool:
        return True


class _AlwaysFalseFilter(FilterBase):
    async def match(self, data: Any) -> bool:
        return False


class _NeedsStubClassifierFilter(FilterBase):
    def used_contexts(self) -> list[type[CollectorClassifierBase[Any]]]:
        return [_StubClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        await data.get(_StubClassifier)
        return True


class _NoopProvider(ProviderBase):
    async def provide(self, data: Any) -> dict[str, Any]:
        return {"test_key": "test_value"}


class _MappingProvider(ProviderBase):
    async def provide(self, data: Any) -> MappingProxyType[str, object]:
        return MappingProxyType({"mapping_key": "mapping_value", "empty": None})


class _RaisingProvider(ProviderBase):
    async def provide(self, data: Any) -> dict[str, Any]:
        raise ValueError("provider boom")


class _AlwaysNotifyFactory(FactoryBase):
    async def pre_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> bool:
        return True


class _PostNotifyRaisingFactory(_AlwaysNotifyFactory):
    def __init__(self, worker: object) -> None:
        super().__init__(worker)
        self.post_notify_called = False

    async def post_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> None:
        self.post_notify_called = True
        raise ValueError("post-notify boom")


@pytest.fixture
def stub_factory() -> FactoryBase:
    factory = FactoryBase(worker=None)
    factory.register_classifier(_StubClassifier, _StubCollector, {_StubClassifier.__name__: {}})
    return factory


@pytest.fixture
def stub_mediator(stub_factory: FactoryBase) -> ObserverMediator:
    return ObserverMediator(stub_factory)


# ---------------------------------------------------------------------------
# JsonRpcFactory / HistoryDataFactory registration counts
# ---------------------------------------------------------------------------


class TestFactoryRegistrations:
    def test_jsonrpc_factory_registers_expected_classifiers(self, mock_worker: FakeWorker) -> None:
        factory = JsonRpcFactory(mock_worker)
        assert set(factory._collectors_per_classifier) == {
            AccountClassifier,
            BlockClassifier,
            BlockHeaderClassifier,
            ChangeRecoveryInProgressClassifier,
            ContentMetadataClassifier,
            DeclineVotingRightsClassifier,
            DynamicGlobalPropertiesClassifier,
            FeedPriceClassifier,
            ImpactedAccountClassifier,
            ManabarClassifier,
            OperationClassifier,
            RcAccountClassifier,
            WitnessClassifier,
        }

    def test_history_data_factory_registers_expected_classifiers(self, mock_worker: FakeWorker) -> None:
        factory = HistoryDataFactory(mock_worker, from_block=1, to_block=10)
        assert set(factory._collectors_per_classifier) == {
            BlockClassifier,
            BlockHeaderClassifier,
            ContentMetadataClassifier,
            DynamicGlobalPropertiesClassifier,
            ImpactedAccountClassifier,
            OperationClassifier,
        }


# ---------------------------------------------------------------------------
# DataEvaluationContext
# ---------------------------------------------------------------------------


class TestDataEvaluationContext:
    @pytest.mark.asyncio
    async def test_get_caches_per_collector_instance(self) -> None:
        """DEC.get() should cache the result keyed by collector id."""
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)

        call_count = 0

        class _CountingCollector(CollectorBase):
            async def get(self, data: Any) -> dict[str, Any]:
                nonlocal call_count
                call_count += 1
                return {_StubClassifier.__name__: {"value": 42}}

        collector = _CountingCollector(worker=None)
        ctx.inject(_StubClassifier, collector)

        r1 = await ctx.get(_StubClassifier)
        r2 = await ctx.get(_StubClassifier)
        assert r1 == {"value": 42}
        assert r2 == {"value": 42}
        # Collector.get() must have been called only once
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_concurrent_get_reuses_in_flight_collector_call(self) -> None:
        """Concurrent DEC.get() calls should share the same in-flight collector task."""
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)

        call_count = 0

        class _SlowCountingCollector(CollectorBase):
            async def get(self, data: Any) -> dict[str, Any]:
                nonlocal call_count
                call_count += 1
                await asyncio.sleep(0.01)
                return {_StubClassifier.__name__: {"value": 42}}

        ctx.inject(_StubClassifier, _SlowCountingCollector(worker=None))

        r1, r2 = await asyncio.gather(ctx.get(_StubClassifier), ctx.get(_StubClassifier))

        assert r1 == {"value": 42}
        assert r2 == {"value": 42}
        assert call_count == 1

    @pytest.mark.asyncio
    async def test_cancelled_get_waiter_does_not_cancel_cached_collector_task(self) -> None:
        """Canceling one DEC.get() waiter must not poison the shared collector task."""
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)
        started = asyncio.Event()
        release = asyncio.Event()
        call_count = 0

        class _SlowCountingCollector(CollectorBase):
            async def get(self, data: Any) -> dict[str, Any]:
                nonlocal call_count
                call_count += 1
                started.set()
                await release.wait()
                return {_StubClassifier.__name__: {"value": 42}}

        ctx.inject(_StubClassifier, _SlowCountingCollector(worker=None))

        first_waiter = asyncio.create_task(ctx.get(_StubClassifier))
        await started.wait()

        first_waiter.cancel()
        with pytest.raises(asyncio.CancelledError):
            await first_waiter

        release.set()
        result = await asyncio.wait_for(ctx.get(_StubClassifier), timeout=1)

        assert result == {"value": 42}
        assert call_count == 1

    def test_access_store_returns_mutable_dict(self) -> None:
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)
        collector = _StubCollector({_StubClassifier.__name__: {}})
        ctx.inject(_StubClassifier, collector)

        store = ctx.access_store(_StubClassifier)
        assert isinstance(store, dict)
        store["foo"] = "bar"
        # Same reference on second access
        assert ctx.access_store(_StubClassifier)["foo"] == "bar"

    def test_access_store_creates_new_dict_if_not_injected(self) -> None:
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)
        store = ctx.access_store(_StubClassifier)
        assert isinstance(store, dict)
        assert len(store) == 0

    @pytest.mark.asyncio
    async def test_get_raises_for_unregistered_classifier(self) -> None:
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)

        with pytest.raises(RuntimeError, match="does not support classifier"):
            await ctx.get(_StubClassifier)

    @pytest.mark.asyncio
    async def test_get_raises_when_collector_omits_classifier_key(self) -> None:
        factory = FactoryBase(worker=None)
        ctx = DataEvaluationContext(factory)
        ctx.inject(_StubClassifier, _StubCollector({"WrongClassifier": {"value": 42}}))

        with pytest.raises(KeyError, match=_StubClassifier.__name__):
            await ctx.get(_StubClassifier)


# ---------------------------------------------------------------------------
# FactoryBase push_classifier / pop_classifier reference counting
# ---------------------------------------------------------------------------


class TestFactoryPushPop:
    def test_push_increments_register_count(self, stub_factory: FactoryBase) -> None:
        collector = stub_factory._collectors[_StubCollector]
        assert collector._registers_count == 0

        stub_factory.push_classifier(_StubClassifier, EClassifierOrigin.FILTER)
        assert collector._registers_count == 1

        stub_factory.push_classifier(_StubClassifier, EClassifierOrigin.PROVIDER)
        assert collector._registers_count == 2

    def test_pop_decrements_register_count(self, stub_factory: FactoryBase) -> None:
        collector = stub_factory._collectors[_StubCollector]

        stub_factory.push_classifier(_StubClassifier, EClassifierOrigin.FILTER)
        stub_factory.push_classifier(_StubClassifier, EClassifierOrigin.FILTER)
        assert collector._registers_count == 2

        stub_factory.pop_classifier(_StubClassifier, EClassifierOrigin.FILTER)
        assert collector._registers_count == 1

    def test_push_unknown_classifier_raises(self) -> None:
        factory = FactoryBase(worker=None)
        with pytest.raises(RuntimeError, match="does not support classifier"):
            factory.push_classifier(_StubClassifier, EClassifierOrigin.FILTER)

    def test_collect_only_includes_registered_classifiers(self, stub_factory: FactoryBase) -> None:
        # Not pushed yet -> has_registered is False -> collect skips it
        ctx = stub_factory.collect()
        assert _StubClassifier not in ctx._collectors

        stub_factory.push_classifier(_StubClassifier, EClassifierOrigin.FILTER)
        ctx2 = stub_factory.collect()
        assert _StubClassifier in ctx2._collectors


# ---------------------------------------------------------------------------
# ObserverMediator register/unregister lifecycle
# ---------------------------------------------------------------------------


class TestObserverMediator:
    def test_register_listener(self, stub_mediator: ObserverMediator) -> None:
        listener = Observer(next=lambda data: None)
        filt = _AlwaysTrueFilter()
        provider = _NoopProvider()

        stub_mediator.register_listener(listener, filt, [provider])
        assert len(stub_mediator._filters) == 1

    def test_unregister_listener(self, stub_mediator: ObserverMediator) -> None:
        listener = Observer(next=lambda data: None)
        filt = _AlwaysTrueFilter()

        stub_mediator.register_listener(listener, filt, [])
        assert len(stub_mediator._filters) == 1

        stub_mediator.unregister_listener(listener)
        assert len(stub_mediator._filters) == 0

    def test_unregister_calls_complete(self, stub_mediator: ObserverMediator) -> None:
        complete_called = False

        def _complete() -> None:
            nonlocal complete_called
            complete_called = True

        listener = Observer(next=lambda data: None, complete=_complete)
        stub_mediator.register_listener(listener, _AlwaysTrueFilter(), [])
        stub_mediator.unregister_listener(listener)
        assert complete_called

    def test_unregister_all_listeners(self, stub_mediator: ObserverMediator) -> None:
        for _ in range(3):
            listener = Observer(next=lambda data: None)
            stub_mediator.register_listener(listener, _AlwaysTrueFilter(), [])
        assert len(stub_mediator._filters) == 3

        stub_mediator.unregister_all_listeners()
        assert len(stub_mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_process_listener_calls_next_when_filter_matches(self, mock_worker: FakeWorker) -> None:
        """Test the _process_listener path directly: filter matches -> provider.provide -> listener.next."""
        factory = JsonRpcFactory(mock_worker)
        mediator = ObserverMediator(factory)

        received: list[dict[str, Any]] = []

        def on_next(data: dict[str, Any]) -> None:
            received.append(data)

        listener = Observer(next=on_next)
        filt = _AlwaysTrueFilter()
        provider = _NoopProvider()

        mediator.register_listener(listener, filt, [provider])

        # Build context the same way notify() does, then call _process_listener directly
        context = factory.collect()
        # Simulate pre_notify setting the block number (so the factory is in a valid state)
        should_continue = await factory.pre_notify(context, mediator)
        assert should_continue is True

        entry = next(iter(mediator._filters.values()))
        await mediator._process_listener(context, entry)

        assert len(received) == 1
        assert received[0]["test_key"] == "test_value"

    @pytest.mark.asyncio
    async def test_process_listener_does_not_call_next_when_filter_rejects(self, mock_worker: FakeWorker) -> None:
        """Test the _process_listener path directly: filter rejects -> listener.next NOT called."""
        factory = JsonRpcFactory(mock_worker)
        mediator = ObserverMediator(factory)

        received: list[dict[str, Any]] = []
        listener = Observer(next=lambda data: received.append(data))

        mediator.register_listener(listener, _AlwaysFalseFilter(), [_NoopProvider()])

        context = factory.collect()
        await factory.pre_notify(context, mediator)

        entry = next(iter(mediator._filters.values()))
        await mediator._process_listener(context, entry)

        assert len(received) == 0

    @pytest.mark.asyncio
    async def test_async_next_callback_is_awaited(self, mock_worker: FakeWorker) -> None:
        """An ``async def`` next callback is awaited by the mediator."""
        factory = JsonRpcFactory(mock_worker)
        mediator = ObserverMediator(factory)

        received: list[dict[str, Any]] = []

        async def on_next(data: dict[str, Any]) -> None:
            received.append(data)

        mediator.register_listener(Observer(next=on_next), _AlwaysTrueFilter(), [_NoopProvider()])

        context = factory.collect()
        await factory.pre_notify(context, mediator)

        entry = next(iter(mediator._filters.values()))
        await mediator._process_listener(context, entry)

        assert len(received) == 1
        assert received[0]["test_key"] == "test_value"

    @pytest.mark.asyncio
    async def test_process_listener_merges_mapping_provider_results(self, mock_worker: FakeWorker) -> None:
        factory = JsonRpcFactory(mock_worker)
        mediator = ObserverMediator(factory)

        received: list[dict[str, Any]] = []
        mediator.register_listener(Observer(next=received.append), _AlwaysTrueFilter(), [_MappingProvider()])

        context = factory.collect()
        await factory.pre_notify(context, mediator)

        entry = next(iter(mediator._filters.values()))
        await mediator._process_listener(context, entry)

        assert received == [{"mapping_key": "mapping_value"}]

    @pytest.mark.asyncio
    async def test_async_error_callback_is_awaited(self, mock_worker: FakeWorker) -> None:
        """An ``async def`` error callback is awaited when a provider raises."""
        factory = JsonRpcFactory(mock_worker)
        mediator = ObserverMediator(factory)

        errors: list[BaseException] = []

        async def on_error(err: BaseException) -> None:
            errors.append(err)

        mediator.register_listener(Observer(error=on_error), _AlwaysTrueFilter(), [_RaisingProvider()])

        context = factory.collect()
        await factory.pre_notify(context, mediator)

        entry = next(iter(mediator._filters.values()))
        await mediator._process_listener(context, entry)

        assert len(errors) == 1
        assert str(errors[0]) == "provider boom"

    @pytest.mark.asyncio
    async def test_notify_reports_pipeline_error_without_error_callback(self) -> None:
        factory = _AlwaysNotifyFactory(worker=None)
        mediator = ObserverMediator(factory)
        provider_called = False
        loop = asyncio.get_running_loop()
        previous_handler = loop.get_exception_handler()
        unhandled_errors: list[BaseException] = []

        class _TrackingRaisingProvider(ProviderBase):
            async def provide(self, data: DataEvaluationContext) -> dict[str, Any]:
                nonlocal provider_called
                provider_called = True
                raise ValueError("provider boom")

        def capture_unhandled(_loop: asyncio.AbstractEventLoop, context: dict[str, object]) -> None:
            exception = context.get("exception")
            assert isinstance(exception, BaseException)
            unhandled_errors.append(exception)

        loop.set_exception_handler(capture_unhandled)
        try:
            mediator.register_listener(Observer(next=lambda data: None), _AlwaysTrueFilter(), [_TrackingRaisingProvider()])

            await mediator.notify()
            await mediator.drain()
        finally:
            loop.set_exception_handler(previous_handler)

        assert provider_called is True
        assert [str(error) for error in unhandled_errors] == ["provider boom"]

    @pytest.mark.asyncio
    async def test_notify_swallows_listener_error_callback_failure_like_ts(self) -> None:
        factory = _AlwaysNotifyFactory(worker=None)
        mediator = ObserverMediator(factory)
        handled_errors: list[str] = []

        def on_error(error: BaseException) -> None:
            handled_errors.append(str(error))
            raise RuntimeError("error callback boom")

        mediator.register_listener(Observer(error=on_error), _AlwaysTrueFilter(), [_RaisingProvider()])

        await mediator.notify()
        await mediator.drain()
        assert handled_errors == ["provider boom"]

    @pytest.mark.asyncio
    async def test_notify_swallows_post_notify_error_without_error_callback_like_ts(self) -> None:
        factory = _PostNotifyRaisingFactory(worker=None)
        mediator = ObserverMediator(factory)
        mediator.register_listener(Observer(next=lambda data: None), _AlwaysTrueFilter(), [])

        await mediator.notify()
        assert factory.post_notify_called is True

    @pytest.mark.asyncio
    async def test_notify_returns_before_listener_work_finishes_like_ts(self) -> None:
        """notify() schedules listener work and returns after post_notify, like TS."""
        factory = _AlwaysNotifyFactory(worker=None)
        mediator = ObserverMediator(factory)
        received: list[dict[str, Any]] = []
        listener_done = asyncio.Event()

        async def on_next(data: dict[str, Any]) -> None:
            await asyncio.sleep(0.01)
            received.append(data)
            listener_done.set()

        mediator.register_listener(Observer(next=on_next), _AlwaysTrueFilter(), [_NoopProvider()])

        await mediator.notify()

        assert received == []
        await asyncio.wait_for(listener_done.wait(), timeout=1)
        assert received == [{"test_key": "test_value"}]

    @pytest.mark.asyncio
    async def test_notify_defers_listener_registered_during_current_cycle(self) -> None:
        """A listener registered mid-cycle waits for the next freshly built context."""
        received: list[dict[str, Any]] = []

        class RegisteringFactory(_AlwaysNotifyFactory):
            def __init__(self) -> None:
                super().__init__(worker=None)
                self.register_classifier(_StubClassifier, _StubCollector, {_StubClassifier.__name__: {}})
                self._registered = False

            async def pre_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> bool:
                if not self._registered:
                    self._registered = True
                    mediator.register_listener(Observer(next=received.append), _NeedsStubClassifierFilter(), [_NoopProvider()])
                return True

        mediator = ObserverMediator(RegisteringFactory())

        await mediator.notify()
        assert received == []

        await mediator.notify()
        for _ in range(10):
            if received:
                break
            await asyncio.sleep(0)
        assert received == [{"test_key": "test_value"}]

    @pytest.mark.asyncio
    async def test_async_complete_callback_is_scheduled(self, mock_worker: FakeWorker) -> None:
        """An ``async def`` complete callback is scheduled and runs at teardown."""
        factory = JsonRpcFactory(mock_worker)
        mediator = ObserverMediator(factory)

        completed: list[bool] = []

        async def on_complete() -> None:
            completed.append(True)

        observer = Observer(complete=on_complete)
        mediator.register_listener(observer, _AlwaysTrueFilter(), [])
        # unregister is synchronous; an async complete is scheduled best-effort.
        mediator.unregister_listener(observer)
        assert completed == []  # not awaited inline
        await asyncio.sleep(0)  # let the scheduled coroutine run
        assert completed == [True]
