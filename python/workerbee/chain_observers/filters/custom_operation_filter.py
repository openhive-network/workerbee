"""CustomOperationFilter — matches custom_json_operation with specified ids.

Mirrors src/chain-observers/filters/custom-operation-filter.ts.

Uses OperationClassifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class CustomOperationFilter(FilterBase):
    def __init__(self, ids: list[str | int]) -> None:
        super().__init__()
        self._ids: OrderedSet[str | int] = OrderedSet(ids)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        custom_json_ops = operations_per_type.get("custom_json_operation", [])
        return any(entry["operation"]["id"] in self._ids for entry in custom_json_ops)
