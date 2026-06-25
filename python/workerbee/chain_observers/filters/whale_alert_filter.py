"""WhaleAlertFilter — matches large transfer operations.

Mirrors src/chain-observers/filters/whale-alert-filter.ts.

Uses OperationClassifier. Checks transfer / transfer_from_savings / escrow_transfer /
recurrent_transfer operations where amount >= threshold. For escrow_transfer, checks
BOTH hbd_amount and hive_amount fields.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..utils import is_asset_greater_than
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class WhaleAlertFilter(FilterBase):
    def __init__(self, asset: Any) -> None:
        super().__init__()
        self._asset = asset

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        operations = await data.get(OperationClassifier)
        ops = operations["operations_per_type"]

        return (
            any(is_asset_greater_than(self._asset, op["operation"].get("amount")) for op in ops.get("transfer_operation", []))
            or any(is_asset_greater_than(self._asset, op["operation"].get("amount")) for op in ops.get("transfer_from_savings_operation", []))
            or any(is_asset_greater_than(self._asset, op["operation"].get("hbd_amount")) for op in ops.get("escrow_transfer_operation", []))
            or any(is_asset_greater_than(self._asset, op["operation"].get("hive_amount")) for op in ops.get("escrow_transfer_operation", []))
            or any(is_asset_greater_than(self._asset, op["operation"].get("amount")) for op in ops.get("recurrent_transfer_operation", []))
        )
