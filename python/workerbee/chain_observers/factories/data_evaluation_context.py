"""DataEvaluationContext — central data store for a single evaluation cycle.

Mirrors src/chain-observers/factories/data-evaluation-context.ts.

Key mechanism:
  factory.collect() → DEC
  DEC.inject(ClassifierClass, collector_instance)
  await DEC.get(ClassifierClass) → cached collector result for ClassifierClass
  await DEC.query(ClassifierClass, options) → uncached query
  DEC.access_store(ClassifierClass) → mutable per-classifier dict
"""

from __future__ import annotations

import asyncio
import time
from contextlib import AbstractContextManager, contextmanager
from typing import TYPE_CHECKING, Any, Protocol, TypeVar, cast

if TYPE_CHECKING:
    from collections.abc import Iterator

    from ..classifiers.collector_classifier_base import CollectorClassifierBase
    from ..collectors.collector_base import CollectorBase
    from .factory_base import FactoryBase

ClassifierResultT = TypeVar("ClassifierResultT")


class DataEvaluationContext:
    """Per-notification cache and scratch store for classifiers and collectors."""

    def __init__(self, factory: FactoryBase) -> None:
        self._factory = factory
        self._collectors: dict[type[CollectorClassifierBase[Any]], CollectorBase] = {}
        self._cached_functions: dict[int, asyncio.Task[Any]] = {}
        self._store_data: dict[type[CollectorClassifierBase[Any]], dict[str, Any]] = {}

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        """Time the wrapped block and accumulate the elapsed ms under ``name``::

            with data.add_timing("database_api.find_accounts"):
                result = await ...

        Records even if the block raises.
        """
        start = time.monotonic()
        try:
            yield
        finally:
            self._factory.record_timing(name, (time.monotonic() - start) * 1000)

    def inject(self, classifier: type[CollectorClassifierBase[Any]], collector: CollectorBase) -> None:
        """Attach ``collector`` as the data source for ``classifier`` in this cycle."""
        if classifier in self._collectors:
            return
        self._collectors[classifier] = collector
        self._store_data[classifier] = {}

    async def get(self, classifier: type[CollectorClassifierBase[ClassifierResultT]]) -> ClassifierResultT:
        """Return the cached collector result for ``classifier``, collecting it once."""
        collector = self._collectors.get(classifier)
        if collector is None:
            raise RuntimeError(
                f'Factory "{type(self._factory).__name__}" does not support classifier '
                f'"{classifier.__name__}". Ensure the classifier is registered in the factory.',
            )

        collector_id = id(collector)
        cached = self._cached_functions.get(collector_id)
        if cached is None:

            async def collect() -> Any:
                with self.add_timing(f"{classifier.__name__}#get"):
                    return await collector.get(self)

            cached = asyncio.create_task(collect())
            self._cached_functions[collector_id] = cached
        result = await asyncio.shield(cached)
        return cast("ClassifierResultT", result[classifier.__name__])

    async def query(self, classifier: type[CollectorClassifierBase[Any]], options: Any) -> Any:
        """Run an uncached collector query for ``classifier`` with caller-supplied options."""
        collector = self._collectors.get(classifier)
        if collector is None:
            raise RuntimeError(
                f'Factory "{type(self._factory).__name__}" does not support classifier '
                f'"{classifier.__name__}". Ensure the classifier is registered in the factory.',
            )
        with self.add_timing(f"{classifier.__name__}#query"):
            return await collector.query(self, options)

    def access_store(self, classifier: type[CollectorClassifierBase[Any]]) -> dict[str, Any]:
        """Return mutable per-classifier scratch storage for this evaluation cycle."""
        store = self._store_data.get(classifier)
        if store is None:
            store = {}
            self._store_data[classifier] = store
        return store


class TCollectorEvaluationContext(Protocol):
    """Subset of :class:`DataEvaluationContext` exposed to collectors."""

    def add_timing(self, name: str) -> AbstractContextManager[None]:
        """Time collector work under ``name``."""
        ...

    async def get(self, classifier: type[CollectorClassifierBase[ClassifierResultT]]) -> ClassifierResultT:
        """Return cached data for a classifier dependency."""
        ...

    async def query(self, classifier: type[CollectorClassifierBase[Any]], options: Any) -> Any:
        """Run an uncached query for a classifier dependency."""
        ...


class TFilterEvaluationContext(Protocol):
    """Subset of :class:`DataEvaluationContext` exposed to filters and providers."""

    async def get(self, classifier: type[CollectorClassifierBase[ClassifierResultT]]) -> ClassifierResultT:
        """Return cached data for a classifier dependency."""
        ...

    async def query(self, classifier: type[CollectorClassifierBase[Any]], options: Any) -> Any:
        """Run an uncached query for a classifier dependency."""
        ...

    def access_store(self, classifier: type[CollectorClassifierBase[Any]]) -> dict[str, Any]:
        """Return mutable per-classifier scratch storage."""
        ...


TProviderEvaluationContext = TFilterEvaluationContext
