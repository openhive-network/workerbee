"""CollectorBase — base class for all collectors.

Mirrors src/chain-observers/collectors/collector-base.ts.
Provides reference counting via register/unregister and optional get/query methods.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import TCollectorEvaluationContext
    from ..interfaces import IWorkerBee


class CollectorBase:
    """Base class for all collectors.

    Subclasses override get() and/or query() to provide data.
    The factory manages registration via push_classifier/pop_classifier which
    calls register/unregister here for reference counting.
    """

    def __init__(self, worker: IWorkerBee) -> None:
        self.worker = worker
        self._registers_count: int = 0

    @property
    def has_registered(self) -> bool:
        return self._registers_count > 0

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return []

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        raise NotImplementedError(
            f"Collector {type(self).__name__} does not implement the requested 'get' method",
        )

    async def query(self, data: TCollectorEvaluationContext, options: Any) -> Any:
        raise NotImplementedError(
            f"Collector {type(self).__name__} does not implement the requested 'query' method",
        )

    def push_options(self, data: Any) -> None:
        pass

    def pop_options(self, data: Any) -> None:
        pass

    def register(self, data: Any = None) -> None:
        self._registers_count += 1
        if data is not None:
            self.push_options(data)

    def unregister(self, data: Any = None) -> None:
        self._registers_count -= 1
        if data is not None:
            self.pop_options(data)
