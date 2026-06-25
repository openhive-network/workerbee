"""Tests for WorkerBee.broadcast() — end-to-end with fake chain."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import timedelta
from types import SimpleNamespace

import pytest

from workerbee.chain_observers.bot import WorkerBee
from workerbee.chain_observers.errors import BlockNotAvailableError, WorkerBeeError


class _FakeProtoTransaction:
    def __init__(self, signatures: list[str], expiration: str = "2026-01-01T00:00:00") -> None:
        self.signatures = signatures
        self.expiration = expiration


class _FakeTransaction:
    """Mirrors the wax ITransaction surface broadcast() uses: id / is_signed / transaction.signatures."""

    def __init__(self, tx_id: str = "abc123", signatures: list[str] | None = None, legacy_id: str | None = None) -> None:
        self.id = tx_id
        if legacy_id is not None:
            self.legacy_id = legacy_id
        self.transaction = _FakeProtoTransaction(signatures if signatures is not None else ["a" * 130])

    @property
    def is_signed(self) -> bool:
        return len(self.transaction.signatures) > 0


@dataclass
class _ObservedTransaction:
    signatures: list[str]


@dataclass
class _FakeBlock:
    transactions: list[_ObservedTransaction]
    transaction_ids: list[str]


@dataclass
class _FakeDgp:
    head_block_number: int
    time: str = "2026-01-01T00:00:00"
    current_witness: str = "witness-a"
    downvote_pool_percent: int = 2500
    head_block_id: str = "0000000000000000000000000000000000000000"


class _FakeDatabaseApi:
    def __init__(self, chain: _FakeBroadcastChain) -> None:
        self._chain = chain

    async def get_dynamic_global_properties(self) -> _FakeDgp:
        return _FakeDgp(
            head_block_number=self._chain.head_block_number,
            time=self._chain.block_time,
            head_block_id=f"{self._chain.head_block_number:08x}00000000000000000000000000000000",
        )


class _FakeBlockApi:
    def __init__(self, chain: _FakeBroadcastChain) -> None:
        self._chain = chain

    async def get_block(self, *, block_num: int) -> SimpleNamespace:
        block = self._chain.blocks.get(block_num)
        return SimpleNamespace(block=block)

    async def get_block_range(self, *, starting_block_num: int, count: int) -> SimpleNamespace:
        blocks = [self._chain.blocks[number] for number in range(starting_block_num, starting_block_num + count) if self._chain.blocks.get(number) is not None]
        return SimpleNamespace(blocks=blocks)


class _FakeApi:
    def __init__(self, chain: _FakeBroadcastChain) -> None:
        self.database_api = _FakeDatabaseApi(chain)
        self.block_api = _FakeBlockApi(chain)


class _FakeBroadcastChain:
    """Chain fake that drives WorkerBee through the real collector/filter/provider pipeline."""

    def __init__(self, fail_broadcast: bool = False) -> None:
        self._fail_broadcast = fail_broadcast
        self.broadcast_called = False
        self.broadcast_arg: object | None = None
        self.head_block_number = 1000
        self.block_time = "2026-01-01T00:00:00"
        self.blocks: dict[int, _FakeBlock | _RaisingBlock | None] = {}
        self.api = _FakeApi(self)
        self.on_broadcast: Callable[[], Awaitable[None]] | None = None

    async def broadcast(self, tx: object) -> None:
        self.broadcast_called = True
        self.broadcast_arg = tx
        if self._fail_broadcast:
            raise ConnectionError("Network failure")
        if self.on_broadcast is not None:
            await self.on_broadcast()

    async def notify_block(self, bot: WorkerBee, number: int, transactions: dict[str, list[str]] | None = None) -> None:
        self.head_block_number = number
        txs = transactions or {}
        self.blocks[number] = _FakeBlock(
            transactions=[_ObservedTransaction(signatures) for signatures in txs.values()],
            transaction_ids=list(txs),
        )
        await bot.mediator.notify()

    async def notify_missing_block(self, bot: WorkerBee, number: int) -> None:
        self.head_block_number = number
        self.blocks[number] = None
        await bot.mediator.notify()

    async def notify_block_error(self, bot: WorkerBee, number: int, error: BaseException) -> None:
        self.head_block_number = number
        self.blocks[number] = _RaisingBlock(error)
        await bot.mediator.notify()


class _RaisingBlock:
    def __init__(self, error: BaseException) -> None:
        self._error = error

    @property
    def transactions(self) -> list[object]:
        raise self._error

    @property
    def transaction_ids(self) -> list[str]:
        raise self._error


class TestBroadcastBasic:
    @pytest.mark.asyncio
    async def test_broadcast_calls_chain_broadcast(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-001")

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-001": ["a" * 130]})

        chain.on_broadcast = simulate_block
        await bot.broadcast(tx, expire_in=timedelta(milliseconds=500))

        assert chain.broadcast_called is True
        assert chain.broadcast_arg is tx

    @pytest.mark.asyncio
    async def test_broadcast_network_error_propagates(self) -> None:
        chain = _FakeBroadcastChain(fail_broadcast=True)
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-fail")

        with pytest.raises(ConnectionError, match="Network failure"):
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=200))

    @pytest.mark.asyncio
    async def test_broadcast_timeout_raises(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-timeout")

        with pytest.raises(WorkerBeeError, match="listener has expired"):
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=50))

    @pytest.mark.asyncio
    async def test_broadcast_unsubscribes_after_success(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-unsub")

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-unsub": ["a" * 130]})

        chain.on_broadcast = simulate_block
        await bot.broadcast(tx, expire_in=timedelta(milliseconds=500))

        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_broadcast_accepts_legacy_transaction_id_match(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-modern", legacy_id="tx-legacy")

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-legacy": ["a" * 130]})

        chain.on_broadcast = simulate_block
        await bot.broadcast(tx, expire_in=timedelta(milliseconds=500))

        assert chain.broadcast_called is True
        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_broadcast_unsubscribes_after_timeout(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-timeout2")

        with pytest.raises(WorkerBeeError, match="listener has expired"):
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=50))

        assert len(bot.mediator._filters) == 0


class TestBroadcastSignatureVerification:
    @pytest.mark.asyncio
    async def test_verify_signatures_success(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        sigs = ["b" * 130, "c" * 130]
        tx = _FakeTransaction(tx_id="tx-sig", signatures=sigs)

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-sig": sigs})

        chain.on_broadcast = simulate_block
        await bot.broadcast(tx, expire_in=timedelta(milliseconds=500), verify_signatures=True)
        assert chain.broadcast_called is True
        assert chain.broadcast_arg is tx
        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_verify_signatures_length_mismatch(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-sig-len", signatures=["a" * 130, "b" * 130])

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-sig-len": ["a" * 130]})

        chain.on_broadcast = simulate_block
        with pytest.raises(WorkerBeeError, match="Signatures length mismatch"):
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=500), verify_signatures=True)

    @pytest.mark.asyncio
    async def test_verify_signatures_content_mismatch(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-sig-bad", signatures=["a" * 130])

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-sig-bad": ["x" * 130]})

        chain.on_broadcast = simulate_block
        with pytest.raises(WorkerBeeError, match="Signatures mismatch at index 0"):
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=500), verify_signatures=True)


class TestBroadcastUnsignedGuard:
    """4a: broadcast rejects unsigned transactions before hitting chain API."""

    @pytest.mark.asyncio
    async def test_empty_signatures_raises(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-nosig", signatures=[])

        with pytest.raises(WorkerBeeError, match="without signing"):
            await bot.broadcast(tx)

        assert chain.broadcast_called is False

    @pytest.mark.asyncio
    async def test_dict_tx_without_signatures_raises(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        class DictLikeTx:
            def __init__(self) -> None:
                self.id = "tx-dict-nosig"
                self.transaction = _FakeProtoTransaction([])

            @property
            def is_signed(self) -> bool:
                return False

        tx = DictLikeTx()

        with pytest.raises(WorkerBeeError, match="without signing"):
            await bot.broadcast(tx)

        assert chain.broadcast_called is False

    @pytest.mark.asyncio
    async def test_signed_tx_passes_guard(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-signed", signatures=["sig1"])

        async def simulate_block() -> None:
            await chain.notify_block(bot, 1000, {"tx-signed": ["sig1"]})

        chain.on_broadcast = simulate_block
        await bot.broadcast(tx, expire_in=timedelta(milliseconds=500))

        assert chain.broadcast_called is True


class TestBroadcastBlockNotAvailableError:
    """4b: BlockNotAvailableError is ignored during broadcast listener."""

    @pytest.mark.asyncio
    async def test_block_not_available_ignored(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-bna")

        async def simulate_error_then_success() -> None:
            await chain.notify_missing_block(bot, 1000)
            await chain.notify_block(bot, 1001, {"tx-bna": ["a" * 130]})

        chain.on_broadcast = simulate_error_then_success
        await bot.broadcast(tx, expire_in=timedelta(milliseconds=500))
        assert chain.broadcast_called is True
        assert len(bot.mediator._filters) == 0

    @pytest.mark.asyncio
    async def test_other_errors_still_propagate(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-real-err")

        async def simulate_real_error() -> None:
            await chain.notify_block_error(bot, 1000, RuntimeError("Real chain error"))

        chain.on_broadcast = simulate_real_error
        with pytest.raises(RuntimeError, match="Real chain error"):
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=500))


class TestBroadcastTimeoutDiagnostics:
    """4c: timeout message includes diagnostic information."""

    @pytest.mark.asyncio
    async def test_timeout_includes_blocks_analyzed(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-diag")

        async def simulate_blocks_without_tx() -> None:
            await chain.notify_block(bot, 100, {})

        chain.on_broadcast = simulate_blocks_without_tx
        with pytest.raises(WorkerBeeError) as exc_info:
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=80))

        msg = str(exc_info.value)
        assert "Blocks analyzed:" in msg
        assert "100" in msg
        assert "Transaction broadcast metadata:" in msg

    @pytest.mark.asyncio
    async def test_timeout_includes_tx_id(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-leg")

        with pytest.raises(WorkerBeeError) as exc_info:
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=50))

        msg = str(exc_info.value)
        assert "tx-leg" in msg

    @pytest.mark.asyncio
    async def test_timeout_no_blocks_shows_none(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-no-blocks")

        with pytest.raises(WorkerBeeError) as exc_info:
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=50))

        msg = str(exc_info.value)
        assert "Blocks analyzed: (none)" in msg

    @pytest.mark.asyncio
    async def test_timeout_includes_expire_value(self) -> None:
        chain = _FakeBroadcastChain()
        bot = WorkerBee(chain)

        tx = _FakeTransaction(tx_id="tx-exp")

        with pytest.raises(WorkerBeeError) as exc_info:
            await bot.broadcast(tx, expire_in=timedelta(milliseconds=77))

        msg = str(exc_info.value)
        assert "expire_in" in msg
        assert str(timedelta(milliseconds=77)) in msg


class TestErrorClasses:
    """Verify error class hierarchy."""

    def test_worker_bee_error_is_exception(self) -> None:
        err = WorkerBeeError("test")
        assert isinstance(err, Exception)
        assert str(err) == "test"

    def test_block_not_available_is_worker_bee_error(self) -> None:
        err = BlockNotAvailableError(42)
        assert isinstance(err, WorkerBeeError)
        assert err.block_number == 42
        assert "42" in str(err)
