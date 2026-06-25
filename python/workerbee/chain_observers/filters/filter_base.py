"""FilterBase — base class for all filters.

Mirrors src/chain-observers/filters/filter-base.ts.
Filters have only match() and used_contexts(). No contribute_data().
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..interfaces import IWorkerBee


class FilterBase:
    """Base class for observer filters."""

    def __init__(self) -> None:
        self.worker: IWorkerBee | None = None

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        """Classifier contexts that must be collected before :meth:`match` runs."""
        return []

    async def match(self, data: DataEvaluationContext) -> bool:
        """Return whether the current evaluation context should notify subscribers."""
        raise NotImplementedError
