"""PastQueen — historical data fluent builder.

Mirrors src/past-queen.ts. Extends QueenBee with its own mediator
backed by HistoryDataFactory.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import TYPE_CHECKING, NoReturn

from .errors import WorkerBeeError
from .factories.historydata.factory import HistoryDataFactory
from .observer_mediator import ObserverMediator
from .queen import QueenBee

if TYPE_CHECKING:
    from .enums import ManabarType
    from .interfaces import IWorkerBee


class PastQueen(QueenBee):
    """Historical replay observer builder returned by WorkerBee replay methods.

    It supports operation-based historical filters and replays the requested
    block range. Once replay is exhausted, the history mediator completes its
    subscribers instead of handing them over to the live mediator, matching
    TypeScript ``PastQueen``. Live-only account/feed/RC methods intentionally
    raise, matching TypeScript ``TPastQueen``.
    """

    def __init__(self, worker: IWorkerBee, from_block: int, to_block: int | None = None) -> None:
        factory = HistoryDataFactory(worker, from_block, to_block)
        super().__init__(worker, ObserverMediator(factory))
        self._notify_task: asyncio.Task[None] | None = None

    @staticmethod
    def _raise_live_only(method_name: str) -> NoReturn:
        raise WorkerBeeError(
            f"{method_name} is not available on PastQueen; it requires live-only JSON-RPC collectors and is omitted from TypeScript TPastQueen.",
        )

    def on_accounts_full_manabar(self, manabar_type: ManabarType | int, *accounts: str) -> NoReturn:
        """Raise because manabar checks require live JSON-RPC collectors."""
        self._raise_live_only("on_accounts_full_manabar")

    def on_accounts_manabar_percent(self, manabar_type: ManabarType | int, percent: float, *accounts: str) -> NoReturn:
        """Raise because manabar checks require live JSON-RPC collectors."""
        self._raise_live_only("on_accounts_manabar_percent")

    def provide_manabar_data(self, manabar_type: ManabarType | int, *accounts: str) -> NoReturn:
        """Raise because manabar data requires live JSON-RPC collectors."""
        self._raise_live_only("provide_manabar_data")

    def on_accounts_balance_change(self, include_internal_transfers: bool, *accounts: str) -> NoReturn:
        """Raise because stateful account balance checks are live-only."""
        self._raise_live_only("on_accounts_balance_change")

    def on_accounts_metadata_change(self, *accounts: str) -> NoReturn:
        """Raise because stateful account metadata checks are live-only."""
        self._raise_live_only("on_accounts_metadata_change")

    def provide_accounts(self, *accounts: str) -> NoReturn:
        """Raise because account provider data requires live JSON-RPC collectors."""
        self._raise_live_only("provide_accounts")

    def on_feed_price_change(self, percent: float) -> NoReturn:
        """Raise because feed-price checks are live-only."""
        self._raise_live_only("on_feed_price_change")

    def on_feed_price_no_change(self, last_hours_count: float = 24) -> NoReturn:
        """Raise because feed-price checks are live-only."""
        self._raise_live_only("on_feed_price_no_change")

    def provide_feed_price_data(self) -> NoReturn:
        """Raise because feed-price data requires live JSON-RPC collectors."""
        self._raise_live_only("provide_feed_price_data")

    def on_alarm(self, *accounts: str) -> NoReturn:
        """Raise because account alarm checks are live-only."""
        self._raise_live_only("on_alarm")

    def on_witnesses_missed_blocks(self, missed_blocks_min_count: int, *witnesses: str) -> NoReturn:
        """Raise because witness missed-block checks are live-only."""
        self._raise_live_only("on_witnesses_missed_blocks")

    def provide_witnesses(self, *witnesses: str) -> NoReturn:
        """Raise because witness provider data requires live JSON-RPC collectors."""
        self._raise_live_only("provide_witnesses")

    def provide_rc_accounts(self, *accounts: str) -> NoReturn:
        """Raise because RC account data requires live JSON-RPC collectors."""
        self._raise_live_only("provide_rc_accounts")

    def on_unsubscribe(self) -> None:
        """Cancel replay work and merge replayed factory state into the live mediator."""
        self._cancel_notify_task()
        factory = self.mediator._factory
        if isinstance(factory, HistoryDataFactory):
            factory.cancel_replay()

        self.worker.mediator.extend(self.mediator)

    def on_subscribe(self) -> None:
        """Start the historical replay task for this subscription."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError as error:
            raise RuntimeError("PastQueen subscriptions require a running event loop") from error
        self._notify_task = loop.create_task(self.mediator.notify())
        self._notify_task.add_done_callback(self._clear_notify_task)

    def _cancel_notify_task(self) -> None:
        task = self._notify_task
        self._notify_task = None
        if task is not None and not task.done():
            task.cancel()

    def _clear_notify_task(self, task: asyncio.Task[None]) -> None:
        if self._notify_task is task:
            self._notify_task = None
        with contextlib.suppress(asyncio.CancelledError, Exception):
            task.result()
