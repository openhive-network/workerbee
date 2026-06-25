"""Tests for WorkerBee bot class.

Tests start/stop lifecycle, async context manager, observe property,
iterate() method, and provide_past_operations().
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import TYPE_CHECKING, cast

import pytest

from workerbee.chain_observers.bot import WorkerBee, _AsyncBlockIterator
from workerbee.chain_observers.errors import WorkerBeeError
from workerbee.chain_observers.past_queen import PastQueen
from workerbee.chain_observers.queen import QueenBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection

from .conftest import FakeChain

if TYPE_CHECKING:
    from wax.interfaces import IHiveChainInterface

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def bot(mock_chain: FakeChain) -> WorkerBee:
    return WorkerBee(cast("IHiveChainInterface", mock_chain))


# ---------------------------------------------------------------------------
# Lifecycle tests
# ---------------------------------------------------------------------------


class TestStartStop:
    @pytest.mark.asyncio
    async def test_start_creates_interval_task(self, bot: WorkerBee) -> None:
        assert bot._interval_task is None

        await bot.start()
        assert bot._interval_task is not None
        assert isinstance(bot._interval_task, asyncio.Task)

        await bot.stop()

    @pytest.mark.asyncio
    async def test_stop_cancels_task(self, bot: WorkerBee) -> None:
        await bot.start()
        task = bot._interval_task
        assert task is not None

        await bot.stop()
        assert bot._interval_task is None
        assert task.cancelling() > 0 or task.cancelled()

    @pytest.mark.asyncio
    async def test_stop_is_idempotent(self, bot: WorkerBee) -> None:
        await bot.stop()
        assert bot.running is False
        assert bot._interval_task is None

        await bot.stop()
        assert bot.running is False
        assert bot._interval_task is None

    @pytest.mark.asyncio
    async def test_start_stops_previous_task_before_starting_new(self, bot: WorkerBee) -> None:
        await bot.start()
        first_task = bot._interval_task

        await bot.start()
        second_task = bot._interval_task

        assert first_task is not second_task
        assert first_task is not None
        assert first_task.cancelling() > 0 or first_task.cancelled()

        await bot.stop()

    @pytest.mark.asyncio
    async def test_polling_loop_surfaces_unexpected_notify_failures(self, bot: WorkerBee) -> None:
        loop = asyncio.get_running_loop()
        previous_handler = loop.get_exception_handler()
        contexts: list[dict[str, object]] = []

        def exception_handler(_loop: asyncio.AbstractEventLoop, context: dict[str, object]) -> None:
            contexts.append(context)

        async def notify() -> None:
            raise RuntimeError("notify boom")

        bot.mediator.notify = notify
        loop.set_exception_handler(exception_handler)
        try:
            await bot.start()
            await asyncio.sleep(0)
            await asyncio.sleep(0)

            assert bot.running is False
            assert bot._interval_task is None
            assert contexts
            assert contexts[0]["message"] == "WorkerBee polling loop failed"
            assert isinstance(contexts[0]["exception"], RuntimeError)
            assert str(contexts[0]["exception"]) == "notify boom"
        finally:
            await bot.stop()
            loop.set_exception_handler(previous_handler)


class TestRunningProperty:
    @pytest.mark.asyncio
    async def test_true_after_start(self, bot: WorkerBee) -> None:
        assert bot.running is False
        await bot.start()
        assert bot.running is True
        await bot.stop()

    @pytest.mark.asyncio
    async def test_false_after_stop(self, bot: WorkerBee) -> None:
        await bot.start()
        await bot.stop()
        assert bot.running is False


class TestAclose:
    @pytest.mark.asyncio
    async def test_aclose_stops_and_unregisters(self, bot: WorkerBee) -> None:
        await bot.start()

        bot.observe.on_block().subscribe(on_next=lambda data: None)
        assert len(bot.mediator._filters) == 1

        await bot.aclose()

        assert bot.running is False
        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_aclose_awaits_async_complete(self, bot: WorkerBee) -> None:
        # An async complete callback runs to completion on aclose (deterministic,
        # unlike the best-effort scheduling of the sync close path).
        await bot.start()

        completed: list[bool] = []

        async def on_complete() -> None:
            await asyncio.sleep(0)
            completed.append(True)

        bot.observe.on_block().subscribe(on_next=lambda data: None, on_complete=on_complete)

        await bot.aclose()
        assert completed == [True]

    @pytest.mark.asyncio
    async def test_aclose_waits_for_async_complete_started_by_sync_close(self, bot: WorkerBee) -> None:
        entered = asyncio.Event()
        release = asyncio.Event()
        completed: list[bool] = []

        async def on_complete() -> None:
            entered.set()
            await release.wait()
            completed.append(True)

        subscription = bot.observe.on_block().subscribe(on_next=lambda data: None, on_complete=on_complete)
        subscription.close()
        await entered.wait()

        close_task = asyncio.create_task(bot.aclose())
        await asyncio.sleep(0)
        assert not close_task.done()

        release.set()
        await close_task
        assert completed == [True]

    @pytest.mark.asyncio
    async def test_aclose_closes_chain_wrapper_created_by_extends(self) -> None:
        class ExtendedChain:
            def __init__(self) -> None:
                self.api = SimpleNamespace(block_api=object())
                self.close_calls = 0

            async def aclose(self) -> None:
                self.close_calls += 1

        class BaseChain:
            def __init__(self) -> None:
                self.api = SimpleNamespace()
                self.extended = ExtendedChain()
                self.extends_calls = 0

            def extends(self, api_collection: object) -> ExtendedChain:
                assert api_collection is WorkerBeeApiCollection
                self.extends_calls += 1
                return self.extended

        chain = BaseChain()
        bot = WorkerBee(cast("IHiveChainInterface", chain))

        assert cast("object", bot.chain) is chain.extended
        assert chain.extends_calls == 1

        await bot.aclose()
        await bot.aclose()

        assert chain.extended.close_calls == 1

    @pytest.mark.asyncio
    async def test_aclose_does_not_close_already_extended_external_chain(self) -> None:
        class ExtendedChain:
            def __init__(self) -> None:
                self.api = SimpleNamespace(block_api=object())
                self.extends_calls = 0
                self.close_calls = 0

            def extends(self, api_collection: object) -> object:
                self.extends_calls += 1
                raise AssertionError("already-extended chains must not be extended again")

            async def aclose(self) -> None:
                self.close_calls += 1

        chain = ExtendedChain()
        bot = WorkerBee(cast("IHiveChainInterface", chain))

        assert cast("object", bot.chain) is chain
        assert chain.extends_calls == 0

        await bot.aclose()

        assert chain.close_calls == 0


# ---------------------------------------------------------------------------
# observe property
# ---------------------------------------------------------------------------


class TestObserveProperty:
    def test_returns_queenbee(self, bot: WorkerBee) -> None:
        queen = bot.observe
        assert isinstance(queen, QueenBee)
        assert queen.worker is bot

    def test_each_call_returns_new_instance(self, bot: WorkerBee) -> None:
        q1 = bot.observe
        q2 = bot.observe
        assert q1 is not q2


# ---------------------------------------------------------------------------
# async context manager
# ---------------------------------------------------------------------------


class TestAsyncContextManager:
    @pytest.mark.asyncio
    async def test_starts_and_stops(self, bot: WorkerBee) -> None:
        async with bot:
            assert bot.running is True
        assert bot.running is False

    @pytest.mark.asyncio
    async def test_stops_on_exception(self, bot: WorkerBee) -> None:
        with pytest.raises(ValueError, match="test error"):
            async with bot:
                assert bot.running is True
                raise ValueError("test error")

        assert bot.running is False

    @pytest.mark.asyncio
    async def test_aexit_unregisters_listeners(self, bot: WorkerBee) -> None:
        # Exiting the context manager runs the full aclose() teardown.
        async with bot:
            bot.observe.on_block().subscribe(on_next=lambda data: None)
            assert len(bot.mediator._filters) == 1
        assert bot.running is False
        assert len(bot.mediator._filters) == 0


# ---------------------------------------------------------------------------
# iterate
# ---------------------------------------------------------------------------


class TestIterate:
    def test_returns_async_block_iterator(self, bot: WorkerBee) -> None:
        it = bot.iterate()
        assert isinstance(it, _AsyncBlockIterator)

    def test_aiter_returns_auto_closing_async_iterator(self, bot: WorkerBee) -> None:
        it = bot.__aiter__()
        assert hasattr(it, "__anext__")
        assert hasattr(it, "aclose")

    def test_iterate_with_on_error_callback(self, bot: WorkerBee) -> None:
        captured: list[BaseException] = []
        it = bot.iterate(on_error=captured.append)
        assert isinstance(it, _AsyncBlockIterator)
        assert it._on_error == captured.append


# ---------------------------------------------------------------------------
# provide_past_operations
# ---------------------------------------------------------------------------


class TestProvidePastOperations:
    def test_block_range_returns_past_queen(self, bot: WorkerBee) -> None:
        past = bot.provide_past_operations(10, 20)
        assert isinstance(past, PastQueen)

    @pytest.mark.asyncio
    async def test_relative_time_returns_coroutine(self, bot: WorkerBee) -> None:
        result = bot.provide_past_operations_relative("-1h")
        assert asyncio.iscoroutine(result)
        past = await result
        assert isinstance(past, PastQueen)

    @pytest.mark.asyncio
    async def test_relative_time_non_positive_range_raises(self, bot: WorkerBee) -> None:
        # A range resolving to zero/negative blocks (here "-0s" -> head time)
        # raises WorkerBeeError, mirroring TS providePastOperations.
        with pytest.raises(WorkerBeeError, match="Invalid time range"):
            await bot.provide_past_operations_relative("-0s")


class TestRunForever:
    @pytest.mark.asyncio
    async def test_run_forever_blocks_until_cancelled(self, bot: WorkerBee) -> None:
        task = asyncio.ensure_future(bot.run_forever())
        await asyncio.sleep(0)
        assert not task.done()  # parks indefinitely

        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
