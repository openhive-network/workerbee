from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from workerbee.chain_observers.classifiers.collector_classifier_base import (
    RegisterEvaluationContextT,
)
from workerbee.chain_observers.factories.data_evaluation_context import (
    FilterEvaluationContext,
)

if TYPE_CHECKING:
    from workerbee.bot import WorkerBee


class FilterBase(ABC):
    def __init__(self, worker: WorkerBee) -> None:
        self._worker = worker

    @abstractmethod
    def used_contexts(self) -> list[RegisterEvaluationContextT]: ...

    @abstractmethod
    async def match(self, data: FilterEvaluationContext) -> bool: ...
