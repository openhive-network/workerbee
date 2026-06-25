"""CustomOperationProvider — provides custom_json operations grouped by id.

Mirrors src/chain-observers/providers/custom-operation-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import CustomOperationsPayload, OpBodyTransactionPair

CustomOperationOptions = dict[str, list[str]]


class CustomOperationProvider(ProviderBase):
    def __init__(self) -> None:
        self.ids: OrderedSet[str] = OrderedSet()

    def push_options(self, options: CustomOperationOptions) -> None:
        ids = options.get("ids", [])
        if not ids:
            raise ValueError("ids must not be empty")
        for op_id in ids:
            self.ids.add(op_id)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> CustomOperationsPayload:
        result: dict[str, list[OpBodyTransactionPair]] = {}

        operations = await data.get(OperationClassifier)
        custom_json_ops = operations["operations_per_type"].get("custom_json_operation")
        if custom_json_ops:
            for operation in custom_json_ops:
                op_id = operation["operation"]["id"]
                if not isinstance(op_id, str):
                    continue
                if op_id not in self.ids:
                    continue

                if op_id not in result:
                    result[op_id] = []

                result[op_id].append(
                    {
                        "operation": operation["operation"],
                        "transaction": operation["transaction"],
                    }
                )

        return {"custom_operations": result}
