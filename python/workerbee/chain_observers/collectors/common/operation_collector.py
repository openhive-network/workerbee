"""OperationCollector — extracts operations from block transactions.

Mirrors src/chain-observers/collectors/common/operation-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.operation_classifier import OperationClassifier
from ...payloads import OperationsPerType, OperationTransactionPair
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class OperationCollector(CollectorBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [BlockClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        block_data = await data.get(BlockClassifier)
        transactions = block_data["transactions"]

        operations: list[OperationTransactionPair] = []
        operations_per_type: OperationsPerType = {}

        with data.add_timing("operation_per_type"):
            for tx_data in transactions:
                tx = tx_data["transaction"]
                tx_ops = tx.get("operations", []) if isinstance(tx, dict) else getattr(tx, "operations", [])
                for operation in tx_ops:
                    # WorkerBee uses only hf26 APIs (block_api/database_api), so each
                    # operation is the hf26 envelope `Operation` (op.type / op.value).
                    # The flat `operations` list keeps the envelope; `operations_per_type`
                    # keys by op.type and stores the unwrapped op.value body.
                    operations.append({"operation": operation, "transaction": tx_data})
                    operations_per_type.setdefault(operation.type, []).append(
                        {
                            "operation": operation.value,
                            "transaction": tx_data,
                        }
                    )

        return {
            OperationClassifier.__name__: {
                "operations": operations,
                "operations_per_type": operations_per_type,
            },
        }
