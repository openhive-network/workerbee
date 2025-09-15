from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from workerbee.chain_observers.classifiers.collector_classifier_base import (
    RegisterEvaluationContextT,
)
from workerbee.chain_observers.factories.data_evaluation_context import (
    ProviderEvaluationContext,
)


class ProviderBase(ABC):
    @abstractmethod
    def used_contexts(self) -> list[RegisterEvaluationContextT]: ...

    @abstractmethod
    async def provide(self, data: ProviderEvaluationContext) -> Any: ...
