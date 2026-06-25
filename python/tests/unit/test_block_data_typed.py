"""Runtime tests for the WorkerBee block iterator."""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Protocol, cast

import pytest

from workerbee.chain_observers.bot import WorkerBee
from workerbee.chain_observers.payloads import BlockData

if TYPE_CHECKING:
    from wax.interfaces import IHiveChainInterface


class _ClosableBlockIterator(Protocol):
    def __anext__(self) -> Awaitable[BlockData]: ...

    async def aclose(self) -> None: ...


@dataclass(slots=True)
class _Dgp:
    head_block_number: int
    time: str
    head_block_id: str
    current_witness: str = "witness-a"
    downvote_pool_percent: int = 25


@dataclass(slots=True)
class _Block:
    block_id: str
    witness: str = "witness-a"
    timestamp: str = "2026-01-01T00:00:00"
    transaction_ids: list[str] = field(default_factory=list)
    transactions: list[dict[str, str]] = field(default_factory=list)
    transaction_merkle_root: str = ""
    extensions: list[dict[str, str]] = field(default_factory=list)
    witness_signature: str = ""
    signing_key: str = ""
    previous: str = ""


@dataclass(slots=True)
class _BlockResult:
    block: _Block


class _FakeDatabaseApi:
    def __init__(self, chain: _FakeChain) -> None:
        self._chain = chain

    async def get_dynamic_global_properties(self) -> _Dgp:
        return _Dgp(
            head_block_number=self._chain.head_block_number,
            time="2026-01-01T00:00:00",
            head_block_id=f"{self._chain.head_block_number:08x}00000000000000000000000000000000",
        )


class _FakeBlockApi:
    def __init__(self, chain: _FakeChain) -> None:
        self._chain = chain
        self.raise_on_get_block: BaseException | None = None
        self.requested_blocks: list[int] = []

    async def get_block(self, *, block_num: int) -> _BlockResult:
        self.requested_blocks.append(block_num)
        if self.raise_on_get_block is not None:
            raise self.raise_on_get_block
        return _BlockResult(
            block=_Block(
                block_id=f"{block_num:08x}00000000000000000000000000000000",
            ),
        )


class _FakeApi:
    def __init__(self, chain: _FakeChain) -> None:
        self.database_api = _FakeDatabaseApi(chain)
        self.block_api = _FakeBlockApi(chain)


class _FakeChain:
    endpoint_url = "https://fake.api/"

    def __init__(self) -> None:
        self.head_block_number = 1
        self.api = _FakeApi(self)

    def extends(self, *args: object) -> _FakeChain:
        return self

    def advance(self) -> None:
        self.head_block_number += 1


def _bot(chain: _FakeChain) -> WorkerBee:
    return WorkerBee(cast("IHiveChainInterface", chain))


async def _attached_iterator(bot: WorkerBee) -> tuple[_ClosableBlockIterator, asyncio.Task[BlockData]]:
    iterator = bot.iterate()
    pending = asyncio.create_task(iterator.__anext__())
    await asyncio.sleep(0)
    assert len(bot.mediator._filters) == 1
    return iterator, pending


async def _wait_until(predicate: Callable[[], bool]) -> None:
    for _ in range(10):
        if predicate():
            return
        await asyncio.sleep(0)
    assert predicate()


class TestIterate:
    def test_iterate_rejects_negative_max_queue_size(self) -> None:
        chain = _FakeChain()
        bot = _bot(chain)
        with pytest.raises(ValueError, match="max_queue_size"):
            bot.iterate(max_queue_size=-1)

    @pytest.mark.asyncio
    async def test_iterate_delivers_block_payload_from_notify_pipeline(self) -> None:
        chain = _FakeChain()
        bot = _bot(chain)
        iterator, pending = await _attached_iterator(bot)

        await bot.mediator.notify()

        block = await pending
        assert block["number"] == 1
        assert block["id"] == "0000000100000000000000000000000000000000"
        assert block["witness"] == "witness-a"
        assert block["transactions"] == []
        assert block["transactions_per_id"] == {}
        assert chain.api.block_api.requested_blocks == [1]
        await iterator.aclose()
        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_async_for_break_closes_subscription(self) -> None:
        chain = _FakeChain()
        bot = _bot(chain)

        async def notify_once() -> None:
            await asyncio.sleep(0)
            await bot.mediator.notify()

        notify_task = asyncio.create_task(notify_once())
        async for block in bot:
            assert block["number"] == 1
            break
        await notify_task
        await _wait_until(lambda: len(bot.mediator._filters) == 0)

        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_iterate_async_for_break_closes_subscription(self) -> None:
        chain = _FakeChain()
        bot = _bot(chain)
        iterator = bot.iterate()

        async def notify_once() -> None:
            await asyncio.sleep(0)
            await bot.mediator.notify()

        notify_task = asyncio.create_task(notify_once())
        async for block in iterator:
            assert block["number"] == 1
            break
        await notify_task
        await _wait_until(lambda: len(bot.mediator._filters) == 0)

        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_iterate_default_propagates_subscription_errors(self) -> None:
        chain = _FakeChain()
        chain.api.block_api.raise_on_get_block = ValueError("boom")
        bot = _bot(chain)
        iterator, pending = await _attached_iterator(bot)

        await bot.mediator.notify()

        with pytest.raises(ValueError, match="boom"):
            await pending
        await iterator.aclose()

    @pytest.mark.asyncio
    async def test_iterate_on_error_callback_receives_errors_and_continues(self) -> None:
        chain = _FakeChain()
        chain.api.block_api.raise_on_get_block = ValueError("test")
        bot = _bot(chain)
        captured: list[BaseException] = []
        iterator = bot.iterate(on_error=captured.append)
        pending = asyncio.create_task(iterator.__anext__())
        await asyncio.sleep(0)

        await bot.mediator.notify()

        await _wait_until(lambda: bool(captured))
        assert [str(error) for error in captured] == ["test"]
        assert not pending.done()

        chain.api.block_api.raise_on_get_block = None
        chain.advance()
        await bot.mediator.notify()

        assert (await pending)["number"] == 2
        await iterator.aclose()

    @pytest.mark.asyncio
    async def test_iterate_with_bounded_queue_preserves_pending_blocks(self) -> None:
        chain = _FakeChain()
        bot = _bot(chain)
        iterator = bot.iterate(max_queue_size=1)
        pending = asyncio.create_task(iterator.__anext__())
        await asyncio.sleep(0)
        pending.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await pending

        await bot.mediator.notify()

        chain.advance()
        await bot.mediator.notify()

        assert (await iterator.__anext__())["number"] == 1
        assert (await iterator.__anext__())["number"] == 2

        await iterator.aclose()

    @pytest.mark.asyncio
    async def test_aclose_cancels_bounded_iterator_listener_blocked_on_full_queue(self) -> None:
        chain = _FakeChain()
        bot = _bot(chain)
        iterator = bot.iterate(max_queue_size=1)
        pending = asyncio.create_task(iterator.__anext__())
        await asyncio.sleep(0)
        pending.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await pending

        await bot.mediator.notify()
        chain.advance()
        await bot.mediator.notify()

        await asyncio.wait_for(bot.aclose(), timeout=1)

        assert len(bot.mediator._filters) == 0
