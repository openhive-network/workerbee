"""Interfaces for WorkerBee chain observers.

Mirrors src/interfaces.ts. Defines IWorkerBee protocol, the typed Observer
contract, and shared type aliases.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

# ``ObserverNotification`` (the merged provider payload delivered to ``next``) is
# defined in :mod:`.payloads`, the single home for the typed event payloads, and
# re-exported here (it underpins ``NextCallback``).
from .payloads import ObserverNotification as ObserverNotification

if TYPE_CHECKING:
    from wax.interfaces import IHiveChainInterface

    from .observer_mediator import ObserverMediator
    from .wax_api import WorkerBeeApiCollection

# Observer callbacks may be sync or async — the mediator awaits any awaitable
# the callback returns, so ``async def`` handlers are first-class.
NextCallback = Callable[[ObserverNotification], Awaitable[None] | None]
ErrorCallback = Callable[[BaseException], Awaitable[None] | None]
CompleteCallback = Callable[[], Awaitable[None] | None]


@dataclass(frozen=True, slots=True, eq=False)
class Observer:
    """Typed observer for a subscription.

    The Pythonic replacement for the RxJS ``Partial<Observer>`` string-keyed
    dict used in src/queen.ts. All callbacks are optional and may be either
    synchronous (``def``) or asynchronous (``async def``).

    ``next`` and ``error`` are awaited by the mediator. ``complete`` fires once
    at teardown; because unsubscription is synchronous, an ``async def``
    ``complete`` is scheduled best-effort rather than awaited.

    ``eq=False`` keeps identity-based ``__eq__``/``__hash__``: the mediator keys
    listeners by ``id()``, so two observers with identical callbacks must stay
    distinct.
    """

    next: NextCallback | None = None
    error: ErrorCallback | None = None
    complete: CompleteCallback | None = None


class IWorkerBee:
    """Interface for WorkerBee bot instances.

    Mirrors IWorkerBee from src/interfaces.ts. All collectors, filters,
    factories, and queen classes reference this interface instead of Any.
    """

    # The chain is extended with WorkerBeeApiCollection (adds block_api) in
    # WorkerBee.__init__, so collectors can reach chain.api.block_api statically.
    chain: IHiveChainInterface[WorkerBeeApiCollection]
    mediator: ObserverMediator
