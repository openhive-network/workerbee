"""ObserverMediator — coordinates filter/provider pipeline.

Mirrors src/chain-observers/observer-mediator.ts.

Flow per notify() cycle:
  1. factory.collect() → DataEvaluationContext
  2. factory.pre_notify(context, self) → should_continue
  3. For each listener: schedule filter/provider/next pipeline
  4. factory.post_notify(context, self) without waiting for listener pipelines
"""

from __future__ import annotations

import asyncio
import contextlib
import inspect
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any

from .factories.factory_base import EClassifierOrigin

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable, Iterable

    from .factories.data_evaluation_context import DataEvaluationContext
    from .factories.factory_base import FactoryBase
    from .filters.filter_base import FilterBase
    from .interfaces import Observer
    from .providers.provider_base import ProviderBase


class ObserverMediator:
    """Register observer chains and run the filter/provider notification pipeline."""

    def __init__(self, factory: FactoryBase) -> None:
        self._factory = factory
        self._filters: dict[int, _ListenerEntry] = {}
        self._listener_tasks: set[asyncio.Task[None]] = set()
        self._detached_complete_tasks: set[asyncio.Task[object]] = set()

    @property
    def timings(self) -> dict[str, float]:
        """Latest accumulated timing data from the underlying factory."""
        return self._factory.get_timings()

    @property
    def has_listeners(self) -> bool:
        """Whether at least one listener is currently registered."""
        return bool(self._filters)

    def extend(self, other: ObserverMediator) -> None:
        """Copy listeners and compatible factory state from ``other``."""
        for entry in other._filters.values():
            self.register_listener(entry.listener, entry.filter, entry.providers)
        self._factory.extend(other._factory)

    async def notify(self) -> None:
        """Collect data once and schedule matching-listener notification pipelines."""
        entries = list(self._filters.values())
        try:
            context = self._factory.collect()
            should_continue = await self._factory.pre_notify(context, self)
        except Exception as error:  # noqa: BLE001 - factory failures are routed to listener error callbacks.
            await self._dispatch_error_to_all(error, raise_unhandled=False)
            return

        if not should_continue:
            return

        for entry in entries:
            self._schedule_listener(context, entry)

        try:
            await self._factory.post_notify(context, self)
        except Exception as error:  # noqa: BLE001 - factory failures are routed to listener error callbacks.
            await self._dispatch_error_to_all(error, raise_unhandled=False)

    def _schedule_listener(self, context: DataEvaluationContext, entry: _ListenerEntry) -> None:
        task = asyncio.create_task(self._process_listener_detached(context, entry))
        self._listener_tasks.add(task)
        task.add_done_callback(self._listener_tasks.discard)
        task.add_done_callback(_consume_task_result)

    async def _process_listener_detached(self, context: DataEvaluationContext, entry: _ListenerEntry) -> None:
        try:
            await self._process_listener(context, entry)
        except Exception as error:  # noqa: BLE001 - detached listener failures must be surfaced explicitly.
            asyncio.get_running_loop().call_exception_handler(
                {
                    "message": "Unhandled WorkerBee listener pipeline error",
                    "exception": error,
                },
            )

    async def _process_listener(
        self,
        context: DataEvaluationContext,
        entry: _ListenerEntry,
    ) -> None:
        try:
            with context.add_timing("filters"):
                matched = await entry.filter.match(context)

            if not matched:
                return

            with context.add_timing("providers"):
                provider_results = await asyncio.gather(
                    *(p.provide(context) for p in entry.providers),
                    return_exceptions=True,
                )

            provided_data: dict[str, Any] = {}
            for result in provider_results:
                if isinstance(result, BaseException):
                    raise result
                if isinstance(result, Mapping):
                    for key, value in result.items():
                        if value is not None:
                            provided_data[key] = value

            next_cb = entry.listener.next
            if next_cb is not None:
                await _invoke(next_cb, provided_data)
        except Exception as error:
            if not await _dispatch_error(entry, error):
                raise

    def register_listener(
        self,
        listener: Observer,
        filter: FilterBase,
        providers: Iterable[ProviderBase],
    ) -> None:
        """Register one listener with its filter and provider set."""
        listener_id = id(listener)
        providers_list = list(providers)
        self._filters[listener_id] = _ListenerEntry(listener, filter, providers_list)

        for classifier in filter.used_contexts():
            self._factory.push_classifier(classifier, EClassifierOrigin.FILTER)

        for provider in providers_list:
            for used_context in provider.used_contexts():
                self._factory.push_classifier(used_context, EClassifierOrigin.PROVIDER)

    def _detach_entry(self, entry: _ListenerEntry) -> None:
        """Pop an entry's classifier registrations and drop it from the map."""
        for classifier in entry.filter.used_contexts():
            self._factory.pop_classifier(classifier, EClassifierOrigin.FILTER)

        for provider in entry.providers:
            for used_context in provider.used_contexts():
                self._factory.pop_classifier(used_context, EClassifierOrigin.PROVIDER)

        self._filters.pop(id(entry.listener), None)

    def unregister_listener(self, listener: Observer, *, notify_complete: bool = True) -> None:
        """Remove one listener and optionally run its ``complete`` callback."""
        entry = self._filters.get(id(listener))
        if entry is None:
            return

        self._detach_entry(entry)

        if notify_complete and entry.listener.complete is not None:
            task = _invoke_detached(entry.listener.complete)
            if task is not None:
                self._detached_complete_tasks.add(task)
                task.add_done_callback(self._detached_complete_tasks.discard)

    def unregister_all_listeners(self, *, notify_complete: bool = True) -> None:
        """Remove every registered listener."""
        for entry in list(self._filters.values()):
            self.unregister_listener(entry.listener, notify_complete=notify_complete)

    async def aclose_all_listeners(self, *, cancel_pending: bool = True) -> None:
        """Unregister every listener, awaiting any async ``complete`` callbacks.

        The deterministic counterpart of :meth:`unregister_all_listeners` for
        async teardown (``WorkerBee.aclose`` / ``async with`` exit): an
        ``async def complete`` runs to completion instead of being scheduled
        best-effort. By default, pending listener pipelines are cancelled after
        listeners are detached, which makes shutdown bounded even if a callback
        is blocked on a full iterator queue. Historical replay completion passes
        ``cancel_pending=False`` so notifications already scheduled for the last
        replayed block are delivered before ``complete`` fires.
        """
        if not cancel_pending:
            await self.drain()

        for entry in list(self._filters.values()):
            self._detach_entry(entry)
            if entry.listener.complete is not None:
                with contextlib.suppress(Exception):
                    await _invoke(entry.listener.complete)

        if cancel_pending:
            for task in list(self._listener_tasks):
                if not task.done():
                    task.cancel()

            await self.drain()

        if self._detached_complete_tasks:
            await asyncio.gather(*list(self._detached_complete_tasks), return_exceptions=True)

    async def drain(self) -> None:
        """Wait for currently scheduled listener pipelines to finish."""
        if self._listener_tasks:
            await asyncio.gather(*list(self._listener_tasks), return_exceptions=True)

    async def _dispatch_error_to_all(self, error: BaseException, *, raise_unhandled: bool = True) -> None:
        handled = False
        for entry in list(self._filters.values()):
            handled = await _dispatch_error(entry, error) or handled
        if raise_unhandled and not handled:
            raise error


class _ListenerEntry:
    __slots__ = ("filter", "listener", "providers")

    def __init__(
        self,
        listener: Observer,
        filter: FilterBase,
        providers: list[ProviderBase],
    ) -> None:
        self.listener = listener
        self.filter = filter
        self.providers = providers


async def _invoke(cb: Callable[..., object], *args: object) -> object:
    result = cb(*args)
    if inspect.isawaitable(result):
        return await result
    return result


def _invoke_detached(cb: Callable[..., object], *args: object) -> asyncio.Task[object] | None:
    """Call ``cb`` from a synchronous context, scheduling it if it is async.

    Used for the ``complete`` teardown callback on the synchronous unregister
    path (``Subscription.close()`` -> ``unregister_listener``), which cannot
    await, so an ``async def complete`` is scheduled best-effort. The async
    teardown path (``aclose_all_listeners``) awaits it instead. Errors are
    swallowed.
    """
    with contextlib.suppress(Exception):
        result = cb(*args)
        if inspect.isawaitable(result):
            task = asyncio.create_task(_await_detached(result))
            task.add_done_callback(_consume_task_result)
            return task
    return None


async def _dispatch_error(entry: _ListenerEntry, error: BaseException) -> bool:
    """Route an error to a listener's ``error`` callback.

    Returns whether a callback handled the error. If the callback itself
    raises, the failure is intentionally propagated to the caller.
    """
    error_cb = entry.listener.error
    if error_cb is None:
        return False
    await _invoke(error_cb, error)
    return True


def _consume_task_result(task: asyncio.Task[object]) -> None:
    with contextlib.suppress(asyncio.CancelledError, Exception):
        task.result()


async def _await_detached(awaitable: Awaitable[object]) -> None:
    await awaitable
