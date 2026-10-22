"""FactoryBase — manages classifier→collector registration and lifecycle.

Mirrors src/chain-observers/factories/factory-base.ts.
"""

from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

from ..classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from .data_evaluation_context import DataEvaluationContext

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping

    from ..classifiers.collector_classifier_base import IEvaluationContextClass, TRegisterEvaluationContext
    from ..collectors.collector_base import CollectorBase, TCollectorResult
    from ..interfaces import IWorkerBee
    from ..observer_mediator import ObserverMediator


class EClassifierOrigin:
    FILTER = "filter"
    PROVIDER = "provider"
    FACTORY = "factory"


class FactoryBase:
    def __init__(self, worker: IWorkerBee) -> None:
        self.worker = worker
        self._collectors: dict[Callable[..., CollectorBase], CollectorBase] = {}
        self._collectors_per_classifier: dict[IEvaluationContextClass, Callable[..., CollectorBase]] = {}
        self._current_block_number: int | None = None
        self._timings: dict[str, float] = {}
        self._last_start: float = time.monotonic()
        self._collector_tasks: set[asyncio.Task[TCollectorResult]] = set()

    def get_timings(self) -> dict[str, float]:
        self._timings["total"] = (time.monotonic() - self._last_start) * 1000
        return dict(self._timings)

    def record_timing(self, name: str, timing: float) -> None:
        """Accumulate ``timing`` (ms) under ``name``. Low-level store; callers
        time blocks via the :meth:`DataEvaluationContext.add_timing` context
        manager rather than computing elapsed time by hand."""
        self._timings[name] = self._timings.get(name, 0) + timing

    def register_classifier[**P](
        self,
        classifier: IEvaluationContextClass,
        collector_class: Callable[P, CollectorBase],
        *constructor_args: P.args,
        **constructor_kwargs: P.kwargs,
    ) -> bool:
        """Serve ``classifier`` by ``collector_class``, created from the constructor arguments unless it exists.

        Returns whether it replaced another collector of the classifier (as documented in TS, whose code always
        returns false).
        """
        existing = self._collectors_per_classifier.get(classifier)
        if existing is collector_class:
            return False

        self._collectors_per_classifier[classifier] = collector_class
        # A collector serving several classifiers (e.g. blocks and their headers) is created once and shared.
        if collector_class not in self._collectors:
            self._collectors[collector_class] = collector_class(*constructor_args, **constructor_kwargs)
        return existing is not None

    def unregister_classifier(self, classifier: IEvaluationContextClass) -> bool:
        collector_class = self._collectors_per_classifier.get(classifier)
        if collector_class is None:
            return False

        del self._collectors_per_classifier[classifier]

        instance = self._collectors.get(collector_class)
        if instance is None:
            return False

        del self._collectors[collector_class]
        return True

    def extend(self, other: FactoryBase) -> None:
        for classifier, other_collector_class in other._collectors_per_classifier.items():
            this_collector_class = self._collectors_per_classifier.get(classifier)
            if this_collector_class is None:
                continue
            if this_collector_class is other_collector_class:
                other_instance = other._collectors.get(other_collector_class)
                if other_instance is None:
                    raise RuntimeError(
                        f"Internal error: Collector instance not found for classifier {classifier.__name__} in factory {type(other).__name__}",
                    )
                self._collectors[this_collector_class] = other_instance

    def push_classifier(
        self,
        classifier: TRegisterEvaluationContext,
        origin: str,
        stack: list[IEvaluationContextClass] | None = None,
    ) -> None:
        """Register the collector of ``classifier`` (with its options) and, recursively, of its dependencies."""
        self._walk_classifier(classifier, origin, [] if stack is None else stack, register=True)

    def pop_classifier(
        self,
        classifier: TRegisterEvaluationContext,
        origin: str,
        stack: list[IEvaluationContextClass] | None = None,
    ) -> None:
        """Unregister what :meth:`push_classifier` registered."""
        self._walk_classifier(classifier, origin, [] if stack is None else stack, register=False)

    def _walk_classifier(
        self,
        classifier: TRegisterEvaluationContext,
        origin: str,
        stack: list[IEvaluationContextClass],
        *,
        register: bool,
    ) -> None:
        classifier_class: IEvaluationContextClass
        options: Mapping[str, object] | None = None

        if isinstance(classifier, dict):
            classifier_class = classifier["class"]
            options = classifier.get("options")
        else:
            classifier_class = classifier

        if classifier_class in stack:
            raise RuntimeError(
                f"Circular dependency detected in factory {type(self).__name__} "
                f"for classifier {classifier_class.__name__} (origin: {origin}, "
                f"stack: {[c.__name__ for c in stack]})",
            )

        stack.append(classifier_class)

        collector_class = self._collectors_per_classifier.get(classifier_class)
        if collector_class is None:
            raise RuntimeError(
                f'Factory "{type(self).__name__}" does not support classifier '
                f'"{classifier_class.__name__}" (origin: {origin}, '
                f"stack: {[c.__name__ for c in stack]})",
            )

        instance = self._collectors.get(collector_class)
        if instance is None:
            raise RuntimeError(
                f"Internal error: Collector instance not found for classifier {classifier_class.__name__} in factory {type(self).__name__}",
            )

        if register:
            instance.register(options)
        else:
            instance.unregister(options)

        # A copy of the stack for each dependency - dependencies on the same level are not circular.
        for dependency in instance.used_contexts():
            self._walk_classifier(dependency, origin, list(stack), register=register)

    async def pre_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> bool:
        dgp = await context.get(DynamicGlobalPropertiesClassifier)
        head_block_number: int = dgp["head_block_number"]
        has_block_number_changed = self._current_block_number != head_block_number
        if has_block_number_changed:
            if self._current_block_number is not None:
                self._current_block_number += 1
            else:
                self._current_block_number = head_block_number
        return has_block_number_changed

    async def post_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> None:
        pass

    def _rebuild_data_evaluation_context(self) -> DataEvaluationContext:
        context = DataEvaluationContext(self)
        for classifier, collector_class in self._collectors_per_classifier.items():
            instance = self._collectors.get(collector_class)
            if instance is None:
                raise RuntimeError(
                    f"Internal error: Collector instance not found for classifier {classifier.__name__} in factory {type(self).__name__}",
                )
            if not instance.has_registered:
                continue
            context.inject(classifier, instance)
        return context

    def collect(self) -> DataEvaluationContext:
        return self._rebuild_data_evaluation_context()

    def track_collector_task(self, task: asyncio.Task[TCollectorResult]) -> None:
        """Keep a running collector task of a context of this factory - see :meth:`cancel_collector_tasks`."""
        self._collector_tasks.add(task)
        task.add_done_callback(self._collector_tasks.discard)

    async def cancel_collector_tasks(self) -> None:
        """Cancel the collector tasks still running and wait for them.

        ``DataEvaluationContext.get`` shields a collector task from the cancellation of the pipelines awaiting it (they
        share it), so cancelling the pipelines leaves it running - at teardown it is cancelled here, before the chain
        it calls is closed.
        """
        tasks = list(self._collector_tasks)
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
