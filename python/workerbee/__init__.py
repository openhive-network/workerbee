"""WorkerBee — Python port of @hiveio/workerbee.

Hive blockchain automation library built on hiveio-wax. Provides an
event-based observer pattern for building bots that react to blockchain
events with support for both real-time streaming and historical data.

Public names are lazily loaded (the same ``smart_lazy_import`` mechanism the
hiveio_api packages use), so ``import workerbee`` stays cheap and only pulls in
the heavy ``chain_observers`` tree when a name is actually accessed.

Quick start::

    from wax import create_hive_chain, WaxChainOptions
    from workerbee import WorkerBee

    async with (
        create_hive_chain(WaxChainOptions(endpoint_url="https://api.hive.blog/")) as chain,
        WorkerBee(chain) as bot,
    ):
        bot.observe.on_block().subscribe(on_next=lambda data: print(data))
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from beekeepy._utilities.smart_lazy_import import aggregate_same_import, lazy_module_factory

# NB: ``__version__`` is intentionally NOT in ``__all__`` — it is resolved lazily
# in ``__getattr__`` (computed via importlib.metadata, not a module import), and the
# lazy-import factory validates that every ``__all__`` entry maps to a module.
__all__ = [
    "AlarmType",
    "CollectorClassifierBase",
    "DataEvaluationContext",
    "DynamicGlobalPropertiesClassifier",
    "Exchange",
    "ManabarType",
    "ObserverNotification",
    "Subscription",
    "WorkerBee",
]

if TYPE_CHECKING:
    from .chain_observers.bot import WorkerBee
    from .chain_observers.classifiers import (
        CollectorClassifierBase,
        DynamicGlobalPropertiesClassifier,
    )
    from .chain_observers.enums import Exchange, ManabarType
    from .chain_observers.factories import DataEvaluationContext
    from .chain_observers.interfaces import ObserverNotification
    from .chain_observers.providers import AlarmType
    from .chain_observers.queen import Subscription

    __version__: str

_lazy_getattr = lazy_module_factory(
    globals(),
    *aggregate_same_import("WorkerBee", module="workerbee.chain_observers.bot"),
    *aggregate_same_import(
        "CollectorClassifierBase",
        "DynamicGlobalPropertiesClassifier",
        module="workerbee.chain_observers.classifiers",
    ),
    *aggregate_same_import("Exchange", "ManabarType", module="workerbee.chain_observers.enums"),
    *aggregate_same_import("DataEvaluationContext", module="workerbee.chain_observers.factories"),
    *aggregate_same_import("ObserverNotification", module="workerbee.chain_observers.interfaces"),
    *aggregate_same_import("AlarmType", module="workerbee.chain_observers.providers"),
    *aggregate_same_import("Subscription", module="workerbee.chain_observers.queen"),
)


def __getattr__(name: str) -> object:
    # ``__version__`` is computed (not a module import) so it can't go through the
    # lazy factory; resolve it here, still without importing importlib.metadata at
    # package-import time (it drags in email.*, ~30 ms).
    if name == "__version__":
        import importlib.metadata

        try:
            return importlib.metadata.version("hiveio-workerbee")
        except importlib.metadata.PackageNotFoundError:  # source checkout
            return "0.0.0-dev"
    return _lazy_getattr(name)
