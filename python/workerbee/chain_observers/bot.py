"""WorkerBee — main bot class.

Mirrors src/bot.ts. Uses ObserverMediator + JsonRpcFactory for live mode,
HistoryDataFactory for past mode. Supports async context manager.
"""

from __future__ import annotations

import asyncio
import contextlib
import inspect
from collections.abc import Mapping
from datetime import timedelta
from typing import TYPE_CHECKING, cast

from .errors import BlockNotAvailableError, WorkerBeeError
from .factories.jsonrpc.factory import JsonRpcFactory
from .interfaces import ErrorCallback, IWorkerBee, ObserverNotification
from .observer_mediator import ObserverMediator
from .past_queen import PastQueen
from .payloads import BlockData, BlockPayload, has_payload
from .queen import QueenBee, Subscription
from .utils import _validate_max_queue_size, calculate_relative_time, parse_iso_timestamp
from .wax_api import WorkerBeeApiCollection

if TYPE_CHECKING:
    from wax.interfaces import IHiveChainInterface, IOnlineTransaction, ITransaction

HIVE_BLOCK_INTERVAL_MS = 3000
DEFAULT_BLOCK_INTERVAL_TIMEOUT_MS = 2000

# BlockData lives in .payloads now (single source of truth for typed payloads);
# imported here for the block iterator. TransactionData is re-exported via the
# package __init__, not from this module.
_QueueItem = tuple[str, BlockData | BaseException]


class WorkerBee(IWorkerBee):
    """Main WorkerBee bot for live observation, replay setup, and broadcasts.

    Pass an existing Hive chain. The bot extends it with WorkerBee's block API
    collection when needed, exposes fluent subscriptions through
    :attr:`observe`, and owns deterministic async teardown via
    :meth:`aclose` / ``async with``.
    """

    def __init__(self, chain: IHiveChainInterface) -> None:
        # extends() returns a new chain instance. Reuse a chain that already carries
        # WorkerBee's block_api extension; otherwise WorkerBee owns the wrapper it
        # creates and closes it from aclose().
        if hasattr(getattr(chain, "api", None), "block_api"):
            extended = chain
            self._owned_chain: IHiveChainInterface[WorkerBeeApiCollection] | None = None
        elif hasattr(chain, "extends"):
            extended = chain.extends(WorkerBeeApiCollection)
            self._owned_chain = cast("IHiveChainInterface[WorkerBeeApiCollection]", extended)
        else:
            extended = chain
            self._owned_chain = None

        self.chain: IHiveChainInterface[WorkerBeeApiCollection] = cast(
            "IHiveChainInterface[WorkerBeeApiCollection]",
            extended,
        )
        self.mediator = ObserverMediator(JsonRpcFactory(self))
        self._interval_task: asyncio.Task[None] | None = None

    @property
    def running(self) -> bool:
        """Whether the live polling loop is currently active."""
        return self._interval_task is not None and not self._interval_task.done()

    @property
    def observe(self) -> QueenBee:
        """A fresh :class:`QueenBee` builder for a single subscription chain.

        Every access returns a NEW builder. A ``QueenBee`` can be subscribed
        only once, so begin a new chain off ``bot.observe`` for each
        subscription rather than reusing a stored value::

            bot.observe.on_posts("alice").subscribe(on_next=...)
            bot.observe.on_votes("bob").subscribe(on_next=...)   # new chain
        """
        return QueenBee(self)

    def provide_past_operations(self, from_block: int, to_block: int) -> PastQueen:
        """Replay historical operations over an inclusive block-number range.

        Synchronous — no chain query is needed. For a relative time window
        (e.g. ``"-1h"``) use :meth:`provide_past_operations_relative` instead.
        """
        return PastQueen(self, from_block, to_block)

    async def provide_past_operations_relative(self, relative_time: str) -> PastQueen:
        """Replay historical operations from a relative time to the current head.

        ``relative_time`` is an offset such as ``"-1h"`` or ``"-30m"``. The
        start block is resolved from the head block and chain time, then replay
        runs forward until the historical stream is exhausted. Awaitable
        because it queries dynamic global properties.
        """
        dgp = await self.chain.api.database_api.get_dynamic_global_properties()
        head: int = dgp.head_block_number
        head_time = parse_iso_timestamp(str(dgp.time))

        actual_time = calculate_relative_time(relative_time, head_time)
        blocks_between = int((head_time.timestamp() - actual_time.timestamp()) / 3)

        if blocks_between <= 0:
            raise WorkerBeeError(f"Invalid time range: {relative_time} is in the future")

        return PastQueen(self, head - blocks_between)

    async def broadcast(
        self,
        tx: ITransaction | IOnlineTransaction,
        *,
        expire_in: timedelta = timedelta(milliseconds=HIVE_BLOCK_INTERVAL_MS * 2),
        verify_signatures: bool = False,
    ) -> None:
        """Broadcast a signed transaction and wait until it is seen on-chain.

        ``expire_in`` is how long to wait for the transaction to appear before
        raising (a :class:`datetime.timedelta`, default two block intervals).
        ``verify_signatures`` re-checks the broadcast signatures against the
        original when set.
        """
        # ``tx`` is a wax transaction object — broadcast it directly (Python
        # ``chain.broadcast`` takes the object, not its api-json; the TS
        # toApiJson/createTransactionFromJson round-trip has no Python equivalent).
        if not tx.is_signed:
            raise WorkerBeeError("You are trying to broadcast transaction without signing!")

        tx_id: str = str(tx.id)
        legacy_tx_id_raw = getattr(tx, "legacy_id", None)
        legacy_tx_id = str(legacy_tx_id_raw) if legacy_tx_id_raw is not None else None
        transaction_ids = [tx_id]
        if legacy_tx_id is not None and legacy_tx_id != tx_id:
            transaction_ids.append(legacy_tx_id)
        original_signatures: list[str] = list(tx.transaction.signatures)

        done = asyncio.Event()
        error_holder: list[BaseException] = []
        first_block: list[int] = []
        last_block: list[int] = []
        last_blockchain_time: list[str] = []

        def on_next(val: ObserverNotification) -> None:
            block_raw = val.get("block")
            if isinstance(block_raw, dict):
                block_num = block_raw.get("number")
                if isinstance(block_num, int):
                    if not first_block:
                        first_block.append(block_num)
                    last_block.clear()
                    last_block.append(block_num)
                block_ts = block_raw.get("timestamp")
                if block_ts is not None:
                    # The block timestamp is a datetime at runtime (BlockHeaderData),
                    # so coerce to str for the diagnostic message rather than gating on str.
                    last_blockchain_time.clear()
                    last_blockchain_time.append(str(block_ts))

            txs_raw = val.get("transactions", {})
            if not isinstance(txs_raw, dict):
                return
            # Read-only view; Mapping is covariant so the typed transactions dict fits.
            txs: Mapping[str, object] = txs_raw
            transaction = txs.get(tx_id)
            if transaction is None and legacy_tx_id is not None:
                transaction = txs.get(legacy_tx_id)
            if transaction is None:
                return

            if verify_signatures:
                orig_sigs: list[str] = original_signatures
                tx_sigs: list[str] = transaction.get("signatures", []) if isinstance(transaction, dict) else getattr(transaction, "signatures", [])
                if len(tx_sigs) != len(orig_sigs):
                    error_holder.append(WorkerBeeError("Transaction broadcast error: Signatures length mismatch"))
                    done.set()
                    return
                for i, sig in enumerate(tx_sigs):
                    if sig != orig_sigs[i]:
                        error_holder.append(WorkerBeeError(f"Transaction broadcast error: Signatures mismatch at index {i}"))
                        done.set()
                        return

            done.set()

        def on_error(err: BaseException) -> None:
            if isinstance(err, BlockNotAvailableError):
                return
            error_holder.append(err)
            done.set()

        sub = (
            self.observe.on_transaction_ids(*transaction_ids)
            .on_block()
            .subscribe(
                on_next=on_next,
                on_error=on_error,
            )
        )

        try:
            await self.chain.broadcast(tx)

            try:
                await asyncio.wait_for(done.wait(), timeout=expire_in.total_seconds())
            except TimeoutError:
                tx_expiration = getattr(tx.transaction, "expiration", "unknown")
                blocks_str = "(none)"
                if last_block:
                    blocks_str = str(first_block[0]) if first_block == last_block else f"{first_block[0]} - {last_block[0]}"
                chain_time_str = last_blockchain_time[0] if last_blockchain_time else None
                if not chain_time_str:
                    with contextlib.suppress(Exception):
                        dgp = await self.chain.api.database_api.get_dynamic_global_properties()
                        chain_time_str = str(dgp.time)
                    if not chain_time_str:
                        chain_time_str = "(unable to retrieve)"

                msg = (
                    f"Transaction #{tx_id}{f' (legacy: #{legacy_tx_id})' if legacy_tx_id else ''} "
                    "broadcasted successfully, but listener has expired.\n"
                    f"Blocks analyzed: {blocks_str}\n"
                    f"Transaction broadcast metadata:\n"
                    f"  - Transaction expiration time: {tx_expiration}\n"
                    f"  - Head block blockchain time:  {chain_time_str}\n"
                    f"Try increasing the 'expire_in' option (currently {expire_in}) to allow more time."
                )
                raise WorkerBeeError(msg) from None

            if error_holder:
                raise error_holder[0]
        finally:
            sub.close()

    async def start(self) -> None:
        """Start the background block-polling loop.

        Async so it can only be called from within a running event loop —
        there is no longer a hidden ``asyncio.ensure_future`` that raises an
        obscure "no running event loop" when called from sync code.
        """
        await self.stop()

        async def _loop() -> None:
            while True:
                await self.mediator.notify()
                await asyncio.sleep(DEFAULT_BLOCK_INTERVAL_TIMEOUT_MS / 1000.0)

        self._interval_task = asyncio.create_task(_loop())
        self._interval_task.add_done_callback(self._clear_interval_task)

    def _clear_interval_task(self, task: asyncio.Task[None]) -> None:
        if self._interval_task is task:
            self._interval_task = None
        if task.cancelled():
            return
        exception = task.exception()
        if exception is not None:
            task.get_loop().call_exception_handler(
                {
                    "message": "WorkerBee polling loop failed",
                    "exception": exception,
                    "task": task,
                },
            )

    async def stop(self) -> None:
        """Stop the block-polling loop, awaiting its cancellation.

        Idempotent. Unlike a fire-and-forget cancel, this waits for the loop
        task to actually finish so shutdown is deterministic.
        """
        task = self._interval_task
        if task is None:
            return
        self._interval_task = None
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

    async def aclose(self) -> None:
        """Stop the bot and unregister all listeners, awaiting their complete callbacks.

        The full teardown the async context manager performs on exit; call it
        explicitly when not using ``async with``. Async ``complete`` callbacks
        run to completion (unlike the synchronous ``Subscription.close()``,
        which schedules them best-effort).
        """
        try:
            await self.stop()
            await self.mediator.aclose_all_listeners()
        finally:
            owned_chain = self._owned_chain
            self._owned_chain = None
            if owned_chain is not None:
                await owned_chain.aclose()

    async def run_forever(self) -> None:
        """Block until cancelled, keeping the bot and its subscriptions alive.

        Replaces the ``await asyncio.Event().wait()`` boilerplate in
        long-running scripts. It never returns normally — it only unwinds when
        the awaiting task is cancelled (e.g. Ctrl-C under ``asyncio.run``), and
        that cancellation propagates out so a surrounding
        ``async with WorkerBee(...)`` still tears the bot down on exit.
        """
        await asyncio.Event().wait()

    def iterate(self, on_error: ErrorCallback | None = None, *, max_queue_size: int = 0) -> _AsyncBlockIterator:
        """Iterate over live blocks with ``async for``.

        By default a pipeline error is raised inside the ``async for``. Pass
        ``on_error`` (sync or async) to handle errors with a callback instead;
        iteration then continues rather than raising. ``max_queue_size=0``
        keeps the historical unbounded queue; a positive value bounds the
        iterator's queued blocks while the consumer catches up. The mediator
        still schedules listener pipelines fire-and-forget like TypeScript; the
        bound applies to this iterator queue, not to all mediator background
        work.
        """
        return _AsyncBlockIterator(self, on_error, max_queue_size=max_queue_size)

    def __aiter__(self) -> _AsyncBlockIterator:
        return self.iterate()

    async def __aenter__(self) -> WorkerBee:
        await self.start()
        return self

    async def __aexit__(self, *args: object) -> None:
        await self.aclose()


class _AsyncBlockIterator:
    def __init__(self, bot: WorkerBee, on_error: ErrorCallback | None = None, *, max_queue_size: int = 0) -> None:
        self._bot = bot
        self._on_error = on_error
        self._queue: asyncio.Queue[_QueueItem] = asyncio.Queue(maxsize=_validate_max_queue_size(max_queue_size))
        self._sub: Subscription | None = None

    def _ensure_attached(self) -> None:
        if self._sub is not None:
            return

        async def on_next(data: ObserverNotification) -> None:
            # The subscription below registers provide_block_data(), so the
            # notification always carries the full BlockData under "block".
            if not has_payload(data, BlockPayload):
                await self._queue.put(("error", RuntimeError('Block iterator notification is missing "block" payload')))
                return
            block = cast("BlockData", data.get("block"))
            await self._queue.put(("value", block))

        async def on_error(err: BaseException) -> None:
            # No handler: surface the error through the queue so __anext__
            # re-raises it inside the consumer's ``async for``.
            if self._on_error is None:
                await self._queue.put(("error", err))
                return
            result = self._on_error(err)
            if inspect.isawaitable(result):
                await result

        self._sub = (
            self._bot.observe.on_block()
            .provide_block_data()
            .subscribe(
                on_next=on_next,
                on_error=on_error,
            )
        )

    def __aiter__(self) -> _AsyncBlockIterator:
        return self

    async def __anext__(self) -> BlockData:
        self._ensure_attached()
        kind, val = await self._queue.get()
        if kind == "error":
            if isinstance(val, BaseException):
                raise val
            raise RuntimeError(str(val))
        if not isinstance(val, dict):
            raise RuntimeError(f"Unexpected iterator queue item: {val!r}")
        return val

    async def aclose(self) -> None:
        if self._sub is not None:
            self._sub.close()
            self._sub = None
