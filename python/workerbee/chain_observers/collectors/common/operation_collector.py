"""OperationCollector — extracts operations from block transactions.

Mirrors src/chain-observers/collectors/common/operation-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from hiveio_api import to_builtins

from ...classifier_results import OperationClassifierData
from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.operation_classifier import OperationClassifier
from ...payloads import Operation, OperationsPerType, OperationTransactionPair
from ..collector_base import CollectorBase, TCollectorResult

if TYPE_CHECKING:
    from hiveio_api.operations.hf26 import Hf26Operation

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


def _as_operation(api_operation: Hf26Operation | dict[str, object]) -> Operation:
    """The operation envelope with the body as JSON - also of operations unknown to hiveio_api (left as JSON)."""
    # Hot path of block streaming: only the body is converted back to JSON (the envelope is
    # rebuilt from its tag), which halves the cost of converting the whole model.
    if isinstance(api_operation, dict):  # unknown to hiveio_api - the JSON of the API
        operation_type, value = api_operation["type"], api_operation["value"]
    else:
        operation_type, value = api_operation.type, to_builtins(api_operation.value)
    if not isinstance(value, dict):
        raise TypeError(f"The body of operation {operation_type} is not a JSON object: {value!r}")
    return Operation(type=str(operation_type), value=value)
