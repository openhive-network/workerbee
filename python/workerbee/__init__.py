"""WorkerBee — Python port of @hiveio/workerbee.

Hive blockchain automation library built on hiveio-wax. Provides an
event-based observer pattern for building bots that react to blockchain
events with support for both real-time streaming and historical data.

Public names are loaded lazily (a module ``__getattr__``), so ``import workerbee``
stays cheap and only pulls in the ``chain_observers`` tree when a name is
actually accessed.

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

from ._lazy_import import lazy_getattr

# NB: ``__version__`` is intentionally NOT in ``__all__`` — it is resolved lazily
# in ``__getattr__`` (computed via importlib.metadata, not a module import).
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
    from .chain_observers.classifiers.collector_classifier_base import CollectorClassifierBase
    from .chain_observers.classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
    from .chain_observers.enums import AlarmType, Exchange, ManabarType
    from .chain_observers.factories.data_evaluation_context import DataEvaluationContext
    from .chain_observers.payloads import ObserverNotification
    from .chain_observers.queen import Subscription

    __version__: str

_lazy_getattr = lazy_getattr(
    globals(),
    {
        "AlarmType": ".chain_observers.enums",
        "CollectorClassifierBase": ".chain_observers.classifiers.collector_classifier_base",
        "DataEvaluationContext": ".chain_observers.factories.data_evaluation_context",
        "DynamicGlobalPropertiesClassifier": ".chain_observers.classifiers.dynamic_global_properties_classifier",
        "Exchange": ".chain_observers.enums",
        "ManabarType": ".chain_observers.enums",
        "ObserverNotification": ".chain_observers.payloads",
        "Subscription": ".chain_observers.queen",
        "WorkerBee": ".chain_observers.bot",
    },
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
