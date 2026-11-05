"""Mirrornet test helpers shared by integration tests."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import cast

from wax import WaxChainOptions, create_hive_chain
from wax.interfaces import IHiveChainInterface

from workerbee import WorkerBee
from workerbee.chain_observers.interfaces import CompleteCallback, ErrorCallback
from workerbee.chain_observers.past_queen import PastQueen
from workerbee.chain_observers.queen import Subscription
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection

_REPLAY_TIMEOUT_SECS = 90.0

type ReplayRegister[T] = Callable[
    [PastQueen, IHiveChainInterface[WorkerBeeApiCollection], list[T], ErrorCallback, CompleteCallback],
    Subscription,
]


@asynccontextmanager
async def open_mirrornet_chain(endpoint: str) -> AsyncIterator[IHiveChainInterface[WorkerBeeApiCollection]]:
    """Open a WorkerBee-extended Hive chain for the configured mirrornet endpoint."""
    async with create_hive_chain(WaxChainOptions(endpoint_url=endpoint)) as base_chain:
        extended_chain = cast("IHiveChainInterface[WorkerBeeApiCollection]", base_chain.extends(WorkerBeeApiCollection))
        async with extended_chain as chain:
            yield chain


class MirrornetReplay:
    """Run a closed historical replay against the configured mirrornet endpoint."""

    def __init__(self, endpoint: str) -> None:
        self._endpoint = endpoint

    async def __call__[T](
        self,
        from_block: int,
        to_block: int,
        register: ReplayRegister[T],
    ) -> list[T]:
        results: list[T] = []
        errors: list[BaseException] = []
        replay_exhausted = asyncio.Event()
        replay_failed = asyncio.Event()
        completed = False

        def on_error(error: BaseException) -> None:
            errors.append(error)
            replay_failed.set()

        def on_complete() -> None:
            nonlocal completed
            completed = True
            replay_exhausted.set()

        async with open_mirrornet_chain(self._endpoint) as chain, WorkerBee(chain) as bot:
            replay = bot.provide_past_operations(from_block, to_block)
            subscription = register(replay, bot.chain, results, on_error, on_complete)
            done_task = asyncio.create_task(replay_exhausted.wait())
            error_task = asyncio.create_task(replay_failed.wait())
            try:
                async with asyncio.timeout(_REPLAY_TIMEOUT_SECS):
                    await asyncio.wait({done_task, error_task}, return_when=asyncio.FIRST_COMPLETED)
                if errors:
                    raise errors[0]
            finally:
                done_task.cancel()
                error_task.cancel()
                if not completed:
                    subscription.close()

        return results
