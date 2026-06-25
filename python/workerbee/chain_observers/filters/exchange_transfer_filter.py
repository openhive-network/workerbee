"""ExchangeTransferFilter — matches transfers to/from known exchanges.

Mirrors src/chain-observers/filters/exchange-transfer-filter.ts.

Uses OperationClassifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..utils import is_exchange
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class ExchangeTransferFilter(FilterBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        operations = await data.get(OperationClassifier)
        ops = operations["operations_per_type"]

        transfer = ops.get("transfer_operation")
        from_savings = ops.get("transfer_from_savings_operation")
        escrow = ops.get("escrow_transfer_operation")
        recurrent = ops.get("recurrent_transfer_operation")

        if transfer:
            for op in transfer:
                operation = op["operation"]
                if is_exchange(str(operation.get("from", ""))) or is_exchange(str(operation.get("to", ""))):
                    return True

        if from_savings:
            for op in from_savings:
                operation = op["operation"]
                if is_exchange(str(operation.get("from", ""))) or is_exchange(str(operation.get("to", ""))):
                    return True

        if escrow:
            for op in escrow:
                operation = op["operation"]
                if is_exchange(str(operation.get("from", ""))) or is_exchange(str(operation.get("to", ""))):
                    return True

        if recurrent:
            for op in recurrent:
                operation = op["operation"]
                if is_exchange(str(operation.get("from", ""))) or is_exchange(str(operation.get("to", ""))):
                    return True

        return False
