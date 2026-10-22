"""OperationCollector — extracts operations from block transactions.

Mirrors src/chain-observers/collectors/common/operation-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from hiveio_api import to_builtins

from ...classifier_results import OperationClassifierData
from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.operation_classifier import OperationClassifier
from ...payloads import Operation, OperationsPerType, OperationTransactionPair
from ..collector_base import CollectorBase, TCollectorResult

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class OperationCollector(CollectorBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [BlockClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> TCollectorResult:
        block_data = await data.get(BlockClassifier)
        transactions = block_data["transactions"]

        operations: list[OperationTransactionPair] = []
        operations_per_type: OperationsPerType = {}

        with data.add_timing("operation_per_type"):
            for tx_data in transactions:
                for api_operation in tx_data["transaction"].operations:
                    # WorkerBee uses only hf26 APIs (block_api/database_api), so each
                    # operation is the hf26 envelope (op.type / op.value). Bodies are
                    # read as JSON objects, as TS reads bodies of wax operations - the
                    # models of hiveio_api are converted back to the JSON of the API.
                    # The flat `operations` list keeps the envelope; `operations_per_type`
                    # keys by op.type and stores the unwrapped op.value body.
                    operation = _as_operation(api_operation)
                    operations.append({"operation": operation, "transaction": tx_data})
                    operations_per_type.setdefault(operation.type, []).append(
                        {
                            "operation": operation.value,
                            "transaction": tx_data,
                        }
                    )

        return {
            OperationClassifier: OperationClassifierData(operations=operations, operations_per_type=operations_per_type),
        }


def _as_operation(api_operation: object) -> Operation:
    """The operation envelope with the body as JSON - also of operations unknown to hiveio_api (left as JSON)."""
    envelope = cast("dict[str, object]", to_builtins(api_operation))
    return Operation(type=str(envelope["type"]), value=cast("dict[str, object]", envelope["value"]))
