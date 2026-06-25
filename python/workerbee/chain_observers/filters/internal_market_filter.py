"""InternalMarketFilter — matches limit order operations.

Mirrors src/chain-observers/filters/internal-market-filter.ts.

Uses OperationClassifier. Matches limit_order_create / limit_order_create2 /
limit_order_cancel operations.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class InternalMarketFilter(FilterBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        return bool(
            operations_per_type.get("limit_order_create2_operation")
            or operations_per_type.get("limit_order_cancel_operation")
            or operations_per_type.get("limit_order_create_operation"),
        )
