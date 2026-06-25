"""Mirrornet-backed integration tests for the WorkerBee lifecycle.

Each test points :class:`WorkerBee` at mirrornet and exercises exactly one
lifecycle behaviour: the async context manager, manual ``start()``/``stop()``,
the raw block stream (``async for block in bot``), ``run_forever()`` and the
idempotency of ``stop()``/``aclose()``.

Semantics verified against ``workerbee/chain_observers/bot.py``:

- ``running`` is ``self._interval_task is not None`` — only ``start()`` sets it
  and only ``stop()`` clears it.
- ``__aenter__`` calls ``start()`` and ``__aexit__`` calls ``aclose()`` (which
  calls ``stop()``), so no manual ``start()`` is needed inside ``async with``.
- The raw block stream is driven by the background polling loop that ``start()``
  launches; subscribing alone does not poll, so iteration only yields once the
  bot is running.
- ``run_forever()`` is ``await asyncio.Event().wait()`` — it blocks until the
  awaiting task is cancelled and never returns normally; it does not itself
  produce blocks.

"""

from __future__ import annotations

import asyncio
import contextlib
from itertools import count, pairwise
from typing import TYPE_CHECKING

import pytest
from wax import WaxChainOptions, create_hive_chain

from workerbee import WorkerBee
from workerbee.chain_observers.payloads import BlockData

if TYPE_CHECKING:
    from wax.interfaces import IHiveChainInterface

# Generous ceiling: covers public endpoint latency plus several 3s block-production slots.
_STREAM_TIMEOUT_SECS = 90


@pytest.mark.asyncio
async def test_context_manager_toggles_running(mirrornet_chain: IHiveChainInterface) -> None:
    bot = WorkerBee(mirrornet_chain)
    # __aenter__ runs start(), so the polling loop is live for the body.
    assert bot.running is False
    async with bot as entered:
        assert entered is bot
        assert bot.running is True
    # __aexit__ runs aclose() -> stop(), so the loop is torn down on exit.
    assert bot.running is False


@pytest.mark.asyncio
async def test_manual_start_stop_toggles_running(inactive_workerbee: WorkerBee) -> None:
    assert inactive_workerbee.running is False

    await inactive_workerbee.start()
    assert inactive_workerbee.running is True

    await inactive_workerbee.stop()
    assert inactive_workerbee.running is False


@pytest.mark.asyncio
async def test_raw_block_stream_yields_increasing_block_numbers(workerbee: WorkerBee) -> None:
    numbers: list[int] = []
    async with asyncio.timeout(_STREAM_TIMEOUT_SECS):
        async for block in workerbee:
            # The raw stream registers provide_block_data(), so each item is
            # the full BlockData carrying an integer "number".
            assert isinstance(block, dict)
            number = block["number"]
            assert isinstance(number, int)
            numbers.append(number)
            if len(numbers) >= 3:
                break

    # Collected enough to prove progression, and block numbers strictly increase.
    assert len(numbers) >= 3
    assert all(later > earlier for earlier, later in pairwise(numbers)), numbers


@pytest.mark.asyncio
async def test_run_forever_blocks_then_ends_cleanly_on_stop_and_cancel(workerbee: WorkerBee) -> None:
    # The background loop (started by the workerbee fixture) drives block processing;
    # run_forever() just keeps the awaiting task parked until cancelled.
    seen: list[BlockData] = []
    workerbee.observe.on_block().provide_block_data().subscribe(
        on_next=lambda data: seen.append(data["block"]),
    )

    forever = asyncio.create_task(workerbee.run_forever())

    # Let a couple of blocks flow through while run_forever() is parked.
    async with asyncio.timeout(_STREAM_TIMEOUT_SECS):
        for _ in count():
            if len(seen) >= 2:
                break
            await asyncio.sleep(0.5)

    # run_forever() never returns on its own; it must still be running.
    assert not forever.done()

    # Stop the bot, then cancel the parked task: it must unwind cleanly.
    await workerbee.stop()
    forever.cancel()
    with pytest.raises(asyncio.CancelledError):
        await forever

    # No unhandled exception escaped: at least the two awaited blocks were seen.
    assert len(seen) >= 2


@pytest.mark.asyncio
async def test_double_stop_and_double_aclose_do_not_raise(inactive_workerbee: WorkerBee) -> None:
    await inactive_workerbee.start()
    assert inactive_workerbee.running is True

    # stop() is documented idempotent: a second call is a no-op, not an error.
    await inactive_workerbee.stop()
    await inactive_workerbee.stop()
    assert inactive_workerbee.running is False

    # aclose() (stop + unregister all listeners) is likewise repeatable.
    await inactive_workerbee.aclose()
    await inactive_workerbee.aclose()
    assert inactive_workerbee.running is False


@pytest.mark.asyncio
async def test_aclose_tears_down_listeners(inactive_workerbee: WorkerBee) -> None:
    """``aclose()`` releases resources: it unregisters every listener and runs their
    complete callbacks.

    The lifecycle test plan asks to confirm resources are closed after
    ``aclose()`` (not just that ``running`` flips). We register a real listener,
    then ``aclose()`` and assert the mediator holds no listeners and the
    subscription's complete callback fired -- the async-teardown counterpart of
    ``Subscription.close()``.
    """
    completed: list[bool] = []
    await inactive_workerbee.start()
    inactive_workerbee.observe.on_block().subscribe(
        on_next=lambda _data: None,
        on_complete=lambda: completed.append(True),
    )
    # A listener is now registered on the mediator.
    assert inactive_workerbee.mediator._filters != {}

    await inactive_workerbee.aclose()

    # aclose() stopped the loop, unregistered every listener and ran their
    # complete callbacks to completion.
    assert inactive_workerbee.running is False
    assert inactive_workerbee.mediator._filters == {}
    assert completed == [True]


@pytest.mark.asyncio
async def test_iterate_on_error_routes_pipeline_errors_to_callback() -> None:
    """``bot.iterate(on_error=...)`` hands pipeline errors to the callback and keeps going.

    Pointed at an unreachable endpoint, every polling cycle fails to collect the
    chain state and the mediator dispatches that error to each listener. The raw
    stream's ``on_error`` handler must RECEIVE it -- rather than ``__anext__``
    raising it into the ``async for`` -- which is the continue-on-error contract
    of ``iterate(on_error)``. No node is needed: only the failing pipeline path
    matters, so we point at a refused loopback port.
    """
    async with create_hive_chain(WaxChainOptions(endpoint_url="http://127.0.0.1:1")) as failing_chain:
        errors: list[BaseException] = []
        async with WorkerBee(failing_chain) as bot:
            iterator = bot.iterate(on_error=errors.append)
            # __anext__ both attaches the subscription and then blocks waiting for a
            # value that never arrives (errors go to the callback, not the queue), so
            # drive it in a task purely to attach; the loop's failures flow to on_error.
            pending = asyncio.create_task(iterator.__anext__())
            try:
                async with asyncio.timeout(_STREAM_TIMEOUT_SECS):
                    for _ in count():
                        if errors:
                            break
                        await asyncio.sleep(0.5)
                # on_error consumed the failure, so the stream did not raise it:
                # __anext__ is still parked, not completed-with-exception.
                assert not pending.done()
            finally:
                pending.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await pending
                await iterator.aclose()

    assert errors
    assert all(isinstance(error, BaseException) for error in errors)
