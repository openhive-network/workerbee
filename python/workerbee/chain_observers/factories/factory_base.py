from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Any, TypeAlias

from workerbee.bot import WorkerBee
from workerbee.chain_observers.classifiers.collector_classifier_base import RegisterEvaluationContextT, EvaluationContextClass
from workerbee.chain_observers.collectors.collector_base import CollectorBase


AnyCollectorClass: TypeAlias = type[CollectorBase[Any, Any, Any, Any, Any]]

class ClassifierOrigin(Enum):
    FILTER = "filter"
    PROVIDER = "provider"
    FACTORY = "factory"


class FactoryBase:
    def __init__(self, worker: WorkerBee) -> None:
        self._worker = worker
        self._timings: dict[str, timedelta] = {}
        self._last_start = datetime.now()

        self._collectors: dict[AnyCollectorClass, CollectorBase]
        self._collectors_per_classifier: dict[EvaluationContextClass, AnyCollectorClass] = {}

    def get_timings(self) -> dict[str, timedelta]:
        self._timings["total"] = datetime.now() - self._last_start
        return self._timings

    def add_timing(self, name: str, time: timedelta) -> None:
        self._timings[name] = self._timings.get(name, 0) + time

    def push_classifier(self, classifier: RegisterEvaluationContextT, origin: ClassifierOrigin, stack: list[ClassifierOrigin] | None = None) -> None:
        classifier_cls = classifier.get("class_") if isinstance(classifier, dict) else classifier
        stack = stack or []

        if classifier_cls in stack:
            raise Exception("Rzuce tutaj wyjatek jakis fajny.")

        stack.append(classifier_cls)

        collector = self._collectors_per_classifier.get(classifier_cls)
        if collector is None:
            raise Exception("Rzuce tutaj wyjatek jakis fajny.")

        collector_instance = self._collectors.get(collector)
        if collector_instance is None:
            raise Exception("Rzuce tutaj wyjatek jakis fajny.")