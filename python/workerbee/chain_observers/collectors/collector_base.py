from __future__ import annotations

from abc import ABC, abstractmethod
from typing import ClassVar, TypeVar, Generic
from dataclasses import dataclass

from workerbee.bot import WorkerBee
from workerbee.chain_observers.classifiers.collector_classifier_base import (
    CollectorClassifierBase,
)
from workerbee.chain_observers.factories.data_evaluation_context import (
    CollectorEvaluationContext,
)
from workerbee.chain_observers.classifiers.accounts_classifier import AccountsClassifier

ClassifierT = TypeVar("ClassifierT", bound=CollectorClassifierBase)


@dataclass
class AvailableClassifiers:
    account_classifier: AccountsClassifier.get_type



class CollectorBase(ABC, Generic[ClassifierT]):
    _REGISTERS_COUNT: ClassVar[int] = 0

    def __init__(self, worker: WorkerBee) -> None:
        self._worker = worker

    @abstractmethod
    async def get(self, data: CollectorEvaluationContext): ...
