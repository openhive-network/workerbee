"""Tests for QueenBee subscription and custom observer behavior."""

from __future__ import annotations

import asyncio
import inspect
from collections.abc import Awaitable, Callable
from typing import Any, cast

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from workerbee.chain_observers.classifiers.collector_classifier_base import CollectorClassifierBase
from workerbee.chain_observers.classifiers.content_metadata_classifier import ContentMetadataClassifier
from workerbee.chain_observers.classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from workerbee.chain_observers.classifiers.manabar_classifier import ManabarClassifier
from workerbee.chain_observers.classifiers.operation_classifier import OperationClassifier
from workerbee.chain_observers.collectors.collector_base import CollectorBase
from workerbee.chain_observers.enums import AlarmType, ManabarType
from workerbee.chain_observers.factories.data_evaluation_context import DataEvaluationContext
from workerbee.chain_observers.factories.factory_base import FactoryBase
from workerbee.chain_observers.factories.jsonrpc.factory import JsonRpcFactory
from workerbee.chain_observers.filters.blank_filter import BlankFilter
from workerbee.chain_observers.filters.filter_base import FilterBase
from workerbee.chain_observers.interfaces import IWorkerBee
from workerbee.chain_observers.observer_mediator import ObserverMediator
from workerbee.chain_observers.payloads import ObserverNotification
from workerbee.chain_observers.providers.provider_base import ProviderBase
from workerbee.chain_observers.queen import QueenBee

from .conftest import FakeChain, FixedCollector

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _QueenWorker:
    def __init__(self, chain: FakeChain | None, mediator: ObserverMediator) -> None:
        self.chain = chain
        self.mediator = mediator


class _CustomClassifier(CollectorClassifierBase[dict[str, object]]):
    pass


class _CustomCollector(CollectorBase):
    def __init__(self) -> None:
        super().__init__(worker=None)

    async def get(self, data: Any) -> dict[str, dict[str, object]]:
        return {_CustomClassifier.__name__: {"allowed": True, "value": 7}}


class _ContentMetadataCollector(CollectorBase):
    def __init__(self, content_data: dict[str, dict[str, dict[str, object]]]) -> None:
        super().__init__(worker=None)
        self.content_data = content_data
        self.query_options: list[object] = []

    async def get(self, data: Any) -> dict[str, dict[str, dict[str, dict[str, object]]]]:
        return {ContentMetadataClassifier.__name__: {"content_data": self.content_data}}

    async def query(self, data: Any, options: object) -> dict[str, dict[str, dict[str, object]]]:
        self.query_options.append(options)
        return self.content_data


class _AlwaysNotifyFactory(FactoryBase):
    async def pre_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> bool:
        return True


@pytest.fixture()
def queen(mock_chain: FakeChain) -> QueenBee:
    factory = JsonRpcFactory(mock_chain)
    mediator = ObserverMediator(factory)
    worker = _QueenWorker(mock_chain, mediator)
    return QueenBee(cast("IWorkerBee", worker), mediator)


@pytest.fixture()
def always_notify_queen() -> QueenBee:
    factory = _AlwaysNotifyFactory(worker=None)
    mediator = ObserverMediator(factory)
    worker = _QueenWorker(None, mediator)
    return QueenBee(cast("IWorkerBee", worker), mediator)


@pytest.fixture()
def custom_context_queen() -> tuple[QueenBee, FactoryBase]:
    factory = FactoryBase(worker=None)
    factory.register_classifier(_CustomClassifier, _CustomCollector)
    mediator = ObserverMediator(factory)
    worker = _QueenWorker(None, mediator)
    return QueenBee(cast("IWorkerBee", worker), mediator), factory


def _noop_next(data: Any) -> None:
    return None


def _data_context(*injections: tuple[type[CollectorClassifierBase[Any]], dict[str, object]]) -> DataEvaluationContext:
    context = DataEvaluationContext(FactoryBase(worker=None))
    for classifier, result in injections:
        context.inject(classifier, FixedCollector(result))
    return context


async def _await_if_needed(result: object) -> None:
    if inspect.isawaitable(result):
        await cast("Awaitable[object]", result)


async def _deliver_once(queen: QueenBee, received: list[ObserverNotification]) -> None:
    subscription = queen.subscribe(received.append)
    try:
        await queen.mediator.notify()
        await queen.mediator.drain()
    finally:
        subscription.close()


# ---------------------------------------------------------------------------
# and_ (AND groups)
# ---------------------------------------------------------------------------


class TestAndGroups:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("first_result", "second_result", "expected_count"),
        [
            pytest.param(True, True, 1, id="both-groups-match"),
            pytest.param(True, False, 0, id="second-group-rejects"),
            pytest.param(False, True, 0, id="first-group-rejects"),
        ],
    )
    async def test_and_requires_every_group_to_match(
        self,
        always_notify_queen: QueenBee,
        first_result: bool,
        second_result: bool,
        expected_count: int,
    ) -> None:
        received: list[ObserverNotification] = []

        always_notify_queen.filter(lambda _data: first_result).and_.filter(lambda _data: second_result)

        await _deliver_once(always_notify_queen, received)

        assert len(received) == expected_count

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("first_result", "second_result", "expected_count"),
        [
            pytest.param(True, False, 1, id="first-statement"),
            pytest.param(False, True, 1, id="second-statement"),
            pytest.param(False, False, 0, id="no-statement"),
        ],
    )
    async def test_or_matches_when_any_statement_matches_like_typescript(
        self,
        always_notify_queen: QueenBee,
        first_result: bool,
        second_result: bool,
        expected_count: int,
    ) -> None:
        received: list[ObserverNotification] = []

        always_notify_queen.filter(lambda _data: first_result).filter(lambda _data: second_result)

        await _deliver_once(always_notify_queen, received)

        assert len(received) == expected_count

    @pytest.mark.asyncio
    async def test_or_calls_next_once_when_all_statements_match_like_typescript(self, always_notify_queen: QueenBee) -> None:
        received: list[ObserverNotification] = []
        calls: list[str] = []

        def predicate(name: str) -> Callable[[DataEvaluationContext], bool]:
            def _inner(_data: DataEvaluationContext) -> bool:
                calls.append(name)
                return True

            return _inner

        always_notify_queen.filter(predicate("first")).filter(predicate("second")).filter(predicate("third"))

        await _deliver_once(always_notify_queen, received)

        assert len(received) == 1
        assert sorted(calls) == ["first", "second", "third"]


# ---------------------------------------------------------------------------
# subscribe
# ---------------------------------------------------------------------------


class TestSubscribe:
    def test_double_subscribe_raises(self, queen: QueenBee) -> None:
        queen.on_block()
        queen.subscribe(_noop_next)
        with pytest.raises(RuntimeError, match="Double subscription"):
            queen.subscribe(_noop_next)

    def test_subscribe_returns_subscription(self, queen: QueenBee) -> None:
        queen.on_block()
        sub = queen.subscribe(_noop_next)
        assert hasattr(sub, "close")
        assert callable(sub.close)

    def test_subscription_context_manager(self, queen: QueenBee) -> None:
        queen.on_block()
        sub = queen.subscribe(_noop_next)

        # Context manager support (__enter__ / __exit__)
        with sub:
            assert len(queen.mediator._filters) == 1
        # After __exit__, listener should be removed
        assert len(queen.mediator._filters) == 0

    def test_close_removes_listener(self, queen: QueenBee) -> None:
        queen.on_block()
        sub = queen.subscribe(_noop_next)
        assert len(queen.mediator._filters) == 1

        sub.close()
        assert len(queen.mediator._filters) == 0

    def test_close_is_idempotent(self, queen: QueenBee) -> None:
        queen.on_block()
        sub = queen.subscribe(_noop_next)

        sub.close()
        # A second close (e.g. context-manager exit after a manual close) is a
        # harmless no-op rather than re-running teardown.
        sub.close()
        assert len(queen.mediator._filters) == 0

    def test_subscribe_after_close_raises_like_typescript(self, queen: QueenBee) -> None:
        queen.on_block()
        sub = queen.subscribe(_noop_next)
        sub.close()

        with pytest.raises(RuntimeError, match="Double subscription"):
            queen.subscribe(_noop_next)

    @pytest.mark.asyncio
    async def test_distinct_observers_can_subscribe_independently_like_typescript(self, always_notify_queen: QueenBee) -> None:
        other = QueenBee(always_notify_queen.worker, always_notify_queen.mediator)
        first_payloads: list[ObserverNotification] = []
        second_payloads: list[ObserverNotification] = []

        first = always_notify_queen.subscribe(first_payloads.append)
        second = other.subscribe(second_payloads.append)
        try:
            await always_notify_queen.mediator.notify()
            await always_notify_queen.mediator.drain()
        finally:
            first.close()
            second.close()

        assert len(first_payloads) == 1
        assert len(second_payloads) == 1

    @pytest.mark.asyncio
    async def test_async_next_error_is_reported_without_stopping_observer_like_typescript(self, always_notify_queen: QueenBee) -> None:
        calls = 0
        errors: list[BaseException] = []

        async def on_next(_payload: ObserverNotification) -> None:
            nonlocal calls
            calls += 1
            raise RuntimeError("Intentional error in next()")

        subscription = always_notify_queen.subscribe(on_next=on_next, on_error=errors.append)
        try:
            await always_notify_queen.mediator.notify()
            await always_notify_queen.mediator.drain()
            await always_notify_queen.mediator.notify()
            await always_notify_queen.mediator.drain()
        finally:
            subscription.close()

        assert calls == 2
        assert [str(error) for error in errors] == ["Intentional error in next()", "Intentional error in next()"]

    def test_subscribe_with_no_filters_uses_blank_filter(self, queen: QueenBee) -> None:
        """When no filters are pushed, subscribe uses BlankFilter (always matches)."""
        sub = queen.subscribe(_noop_next)

        entries = list(queen.mediator._filters.values())
        assert len(entries) == 1
        assert isinstance(entries[0].filter, BlankFilter)

        sub.close()


# ---------------------------------------------------------------------------
# provide (inline)
# ---------------------------------------------------------------------------


class TestProvideInline:
    @pytest.mark.asyncio
    async def test_inline_provider_calls_callable_and_returns_payload(self, queen: QueenBee) -> None:
        ctx = DataEvaluationContext(FactoryBase(worker=None))
        calls: list[DataEvaluationContext] = []

        def custom_fn(data: DataEvaluationContext) -> dict[str, object]:
            calls.append(data)
            return {"custom": True}

        queen.provide(custom_fn)
        provider = next(iter(queen._providers.values()))

        assert await provider.provide(ctx) == {"custom": True}
        assert calls == [ctx]

    def test_provide_with_invalid_raises(self, queen: QueenBee) -> None:
        with pytest.raises(TypeError, match="provide"):
            queen.provide(42)

    @pytest.mark.asyncio
    async def test_provider_object_forwards_contexts_and_options(self, custom_context_queen: tuple[QueenBee, FactoryBase]) -> None:
        class ContextProvider(ProviderBase):
            def __init__(self) -> None:
                self.options: list[dict[str, object]] = []

            def used_contexts(self) -> list[type[CollectorClassifierBase[Any]]]:
                return [_CustomClassifier]

            def push_options(self, options: dict[str, object]) -> None:
                self.options.append(options)

            async def provide(self, data: DataEvaluationContext) -> dict[str, object]:
                custom = await data.get(_CustomClassifier)
                return {"custom_value": custom["value"]}

        queen, factory = custom_context_queen
        provider = ContextProvider()
        queen.provide(provider, {"enabled": True})
        subscription = queen.subscribe(_noop_next)

        collector = factory._collectors[_CustomCollector]
        try:
            assert collector.has_registered
            assert provider.options == [{"enabled": True}]
            entry = next(iter(queen.mediator._filters.values()))
            assert await entry.providers[0].provide(factory.collect()) == {"custom_value": 7}
        finally:
            subscription.close()

        assert not collector.has_registered


# ---------------------------------------------------------------------------
# filter (inline)
# ---------------------------------------------------------------------------


class TestFilterInline:
    @pytest.mark.asyncio
    async def test_inline_filter_calls_callable_and_uses_result(self, queen: QueenBee) -> None:
        ctx = DataEvaluationContext(FactoryBase(worker=None))
        calls: list[DataEvaluationContext] = []

        def custom_fn(data: DataEvaluationContext) -> bool:
            calls.append(data)
            return False

        queen.filter(custom_fn)

        assert await queen._operands[0].match(ctx) is False
        assert calls == [ctx]

    def test_filter_with_invalid_raises(self, queen: QueenBee) -> None:
        with pytest.raises(TypeError, match="filter"):
            queen.filter(42)

    @pytest.mark.asyncio
    async def test_filter_object_forwards_contexts(self, custom_context_queen: tuple[QueenBee, FactoryBase]) -> None:
        class ContextFilter(FilterBase):
            def used_contexts(self) -> list[type[CollectorClassifierBase[Any]]]:
                return [_CustomClassifier]

            async def match(self, data: DataEvaluationContext) -> bool:
                custom = await data.get(_CustomClassifier)
                return bool(custom["allowed"])

        queen, factory = custom_context_queen
        queen.filter(ContextFilter())
        subscription = queen.subscribe(_noop_next)

        collector = factory._collectors[_CustomCollector]
        try:
            assert collector.has_registered
            entry = next(iter(queen.mediator._filters.values()))
            assert await entry.filter.match(factory.collect()) is True
        finally:
            subscription.close()

        assert not collector.has_registered


# ---------------------------------------------------------------------------
# filter_piped
# ---------------------------------------------------------------------------


class TestFilterPiped:
    @pytest.mark.asyncio
    async def test_piped_filter_calls_both_callables_and_provider_reuses_payload(self, queen: QueenBee) -> None:
        ctx = DataEvaluationContext(FactoryBase(worker=None))
        provider_calls: list[DataEvaluationContext] = []
        filter_calls: list[tuple[dict[str, object], DataEvaluationContext]] = []
        provided = {"value": 42}

        def provider_fn(data: DataEvaluationContext) -> dict[str, object]:
            provider_calls.append(data)
            return provided

        def filter_fn(payload: dict[str, object], data: DataEvaluationContext) -> bool:
            filter_calls.append((payload, data))
            return payload["value"] == 42

        queen.filter_piped(provider_fn, filter_fn)
        operand = queen._operands[0]
        provider = next(iter(queen._providers.values()))

        assert await operand.match(ctx) is True
        assert await provider.provide(ctx) == provided
        assert provider_calls == [ctx]
        assert filter_calls == [(provided, ctx)]

    @pytest.mark.asyncio
    async def test_multiple_piped_filters_keep_separate_provider_payloads(self, queen: QueenBee) -> None:
        queen.filter_piped(lambda data: {"first": 1}, lambda provided, data: True)
        queen.filter_piped(lambda data: {"second": 2}, lambda provided, data: True)

        ctx = DataEvaluationContext(FactoryBase(worker=None))

        for operand in queen._operands:
            assert await operand.match(ctx)

        payload: dict[str, object] = {}
        for provider in queen._providers.values():
            payload.update(await provider.provide(ctx))

        assert payload == {"first": 1, "second": 2}


# ---------------------------------------------------------------------------
# on_posts_incoming_payout / on_comments_incoming_payout
# ---------------------------------------------------------------------------


class TestQueenLevelProviderWiring:
    @pytest.mark.asyncio
    async def test_accounts_full_manabar_matches_and_provides_selected_manabar(self, queen: QueenBee) -> None:
        subscription = queen.on_accounts_full_manabar(ManabarType.UPVOTE, "alice").subscribe(_noop_next)
        context = _data_context(
            (
                ManabarClassifier,
                {
                    ManabarClassifier.__name__: {
                        "manabar_data": {
                            "alice": {
                                ManabarType.UPVOTE: {
                                    "current_mana": 98,
                                    "last_update_time": 0,
                                    "max": 100,
                                    "percent": 98,
                                },
                            },
                        },
                    },
                },
            )
        )

        try:
            entry = next(iter(queen.mediator._filters.values()))
            assert await entry.filter.match(context) is True
            assert await entry.providers[0].provide(context) == {
                "manabar_data": {
                    "alice": {
                        ManabarType.UPVOTE: {
                            "current_mana": 98,
                            "last_update_time": 0,
                            "max": 100,
                            "percent": 98,
                        },
                    },
                },
            }
        finally:
            subscription.close()

    @pytest.mark.asyncio
    async def test_alarm_matches_and_provides_alarm_for_selected_account(self, queen: QueenBee) -> None:
        subscription = queen.on_alarm("alice").subscribe(_noop_next)
        context = _data_context(
            (
                AccountClassifier,
                {
                    AccountClassifier.__name__: {
                        "accounts": {
                            "alice": {
                                "recovery_account": "steem",
                                "governance_vote_expiration": None,
                            },
                        },
                    },
                },
            ),
            (
                ChangeRecoveryInProgressClassifier,
                {
                    ChangeRecoveryInProgressClassifier.__name__: {
                        "recovering_accounts": {},
                    },
                },
            ),
            (
                DeclineVotingRightsClassifier,
                {
                    DeclineVotingRightsClassifier.__name__: {
                        "decline_voting_rights_accounts": {},
                    },
                },
            ),
        )

        try:
            entry = next(iter(queen.mediator._filters.values()))
            assert await entry.filter.match(context) is True
            assert await entry.providers[0].provide(context) == {
                "alarms_per_account": {
                    "alice": [
                        AlarmType.LEGACY_RECOVERY_ACCOUNT_SET,
                        AlarmType.GOVERNANCE_VOTE_EXPIRED,
                    ],
                },
            }
        finally:
            subscription.close()

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        ("chain_factory", "payload_key", "metadata", "expected_query_window_ms"),
        [
            pytest.param(
                lambda q: q.on_posts_incoming_payout("-30m", "alice"),
                "posts_metadata",
                {
                    "author": "alice",
                    "permlink": "post",
                    "parent_author": "",
                    "is_paid": False,
                },
                30 * 60 * 1000,
                id="posts",
            ),
            pytest.param(
                lambda q: q.on_comments_incoming_payout("-1h", "bob"),
                "comments_metadata",
                {
                    "author": "bob",
                    "permlink": "reply",
                    "parent_author": "alice",
                    "is_paid": False,
                },
                60 * 60 * 1000,
                id="comments",
            ),
        ],
    )
    async def test_incoming_payout_matches_and_provides_metadata(
        self,
        queen: QueenBee,
        chain_factory: Callable[[QueenBee], QueenBee],
        payload_key: str,
        metadata: dict[str, object],
        expected_query_window_ms: int,
    ) -> None:
        account = cast("str", metadata["author"])
        permlink = cast("str", metadata["permlink"])
        content_data = {account: {permlink: metadata}}
        metadata_collector = _ContentMetadataCollector(content_data)
        context = _data_context(
            (
                OperationClassifier,
                {
                    OperationClassifier.__name__: {
                        "operations": [{"operation": metadata, "transaction": {}}],
                        "operations_per_type": {
                            "comment_operation": [
                                {"operation": metadata, "transaction": {}},
                            ],
                        },
                    },
                },
            )
        )
        context.inject(ContentMetadataClassifier, metadata_collector)

        subscription = chain_factory(queen).subscribe(_noop_next)
        try:
            entry = next(iter(queen.mediator._filters.values()))
            assert await entry.filter.match(context) is True
            assert metadata_collector.query_options == [
                {
                    "requested_data": [metadata],
                    "report_after_ms_before_payout": expected_query_window_ms,
                },
            ]
            assert await entry.providers[0].provide(context) == {
                payload_key: content_data,
            }
        finally:
            subscription.close()


class TestOnContentMetadata:
    @pytest.mark.asyncio
    async def test_numeric_window_is_passed_to_content_metadata_query(self, queen: QueenBee) -> None:
        metadata = {
            "author": "alice",
            "permlink": "post",
            "parent_author": "",
            "is_paid": False,
        }
        metadata_collector = _ContentMetadataCollector({"alice": {"post": metadata}})
        context = _data_context(
            (
                OperationClassifier,
                {
                    OperationClassifier.__name__: {
                        "operations": [{"operation": metadata, "transaction": {}}],
                        "operations_per_type": {
                            "comment_operation": [
                                {"operation": metadata, "transaction": {}},
                            ],
                        },
                    },
                },
            )
        )
        context.inject(ContentMetadataClassifier, metadata_collector)

        subscription = queen.on_posts_incoming_payout(6000, "alice").subscribe(_noop_next)
        try:
            entry = next(iter(queen.mediator._filters.values()))
            assert await entry.filter.match(context) is True
            assert metadata_collector.query_options == [
                {
                    "requested_data": [metadata],
                    "report_after_ms_before_payout": 6000,
                },
            ]
        finally:
            subscription.close()


# ---------------------------------------------------------------------------
# async iteration (async for event in observer)
# ---------------------------------------------------------------------------


class TestAsyncIteration:
    @pytest.mark.asyncio
    async def test_async_for_yields_events_and_closes_on_aclose(self, queen: QueenBee) -> None:
        queen.on_block()
        agen = queen.__aiter__()

        # First __anext__ subscribes, then parks awaiting the queue.
        pending = asyncio.ensure_future(agen.__anext__())
        await asyncio.sleep(0)
        assert len(queen.mediator._filters) == 1

        # Simulate the mediator delivering an event to the registered observer.
        entry = next(iter(queen.mediator._filters.values()))
        assert entry.listener.next is not None
        await _await_if_needed(entry.listener.next({"value": 1}))
        assert await pending == {"value": 1}

        # Closing the generator runs its finally -> the subscription is closed.
        await agen.aclose()
        assert len(queen.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_async_for_raises_on_error_and_cleans_up(self, queen: QueenBee) -> None:
        queen.on_block()
        agen = queen.__aiter__()

        pending = asyncio.ensure_future(agen.__anext__())
        await asyncio.sleep(0)
        entry = next(iter(queen.mediator._filters.values()))
        assert entry.listener.error is not None
        await _await_if_needed(entry.listener.error(ValueError("boom")))

        with pytest.raises(ValueError, match="boom"):
            await pending
        # The error propagating out of the generator runs its finally.
        assert len(queen.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_iterate_with_bounded_queue_applies_backpressure(self, queen: QueenBee) -> None:
        queen.on_block()
        agen = queen.iterate(max_queue_size=1)

        pending = asyncio.ensure_future(agen.__anext__())
        await asyncio.sleep(0)
        entry = next(iter(queen.mediator._filters.values()))
        assert entry.listener.next is not None

        first_result = entry.listener.next({"value": 1})
        assert inspect.isawaitable(first_result)
        await cast("Awaitable[None]", first_result)
        assert await pending == {"value": 1}

        queued = asyncio.create_task(cast("Awaitable[None]", entry.listener.next({"value": 2})))
        await asyncio.sleep(0)
        assert queued.done()

        blocked = asyncio.create_task(cast("Awaitable[None]", entry.listener.next({"value": 3})))
        await asyncio.sleep(0)
        assert not blocked.done()

        assert await agen.__anext__() == {"value": 2}
        await blocked
        assert await agen.__anext__() == {"value": 3}

        await agen.aclose()
        assert len(queen.mediator._filters) == 0

    def test_iterate_rejects_negative_max_queue_size(self, queen: QueenBee) -> None:
        with pytest.raises(ValueError, match="max_queue_size"):
            queen.iterate(max_queue_size=-1)

    @pytest.mark.asyncio
    async def test_double_async_iteration_is_rejected(self, queen: QueenBee) -> None:
        queen.on_block()

        agen = queen.__aiter__()
        pending = asyncio.ensure_future(agen.__anext__())
        await asyncio.sleep(0)

        # A QueenBee subscribes once; a second iteration over the same chain
        # hits the double-subscription guard.
        with pytest.raises(RuntimeError, match="Double subscription"):
            await queen.__aiter__().__anext__()

        # Cancelling the in-flight __anext__ runs the generator's finally
        # (closing the first subscription).
        pending.cancel()
        with pytest.raises(asyncio.CancelledError):
            await pending
        assert len(queen.mediator._filters) == 0
