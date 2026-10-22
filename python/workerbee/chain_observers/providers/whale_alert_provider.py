"""WhaleAlertProvider — provides large transfer operations exceeding asset thresholds.

Mirrors src/chain-observers/providers/whale-alert-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from hiveio_api import Asset

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from ..utils import is_asset_greater_than
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from collections.abc import Mapping

    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import OpBodyTransactionPair, WhaleAlertPair, WhaleAlertPayload

WhaleAlertOptions = dict[str, list[Asset]]

# The amount fields of the transfer operations, checked in order - an escrow transfer is reported by its HBD amount,
# else by its HIVE amount (as in TS).
_AMOUNT_FIELDS: dict[str, tuple[str, ...]] = {
    "transfer_operation": ("amount",),
    "transfer_from_savings_operation": ("amount",),
    "escrow_transfer_operation": ("hbd_amount", "hive_amount"),
    "recurrent_transfer_operation": ("amount",),
}


class WhaleAlertProvider(ProviderBase):
    def __init__(self) -> None:
        self.assets: dict[str, Asset] = {}

    def push_options(self, options: WhaleAlertOptions) -> None:
        for asset in options.get("assets", []):
            self.assets[asset.nai] = asset

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> WhaleAlertPayload:
        operations = await data.get(OperationClassifier)
        ops_per_type = operations["operations_per_type"]

        whale_operations: list[WhaleAlertPair] = []

        for asset in self.assets.values():
            for op_type, amount_fields in _AMOUNT_FIELDS.items():
                for op in ops_per_type.get(op_type, []):
                    whale_operation = _whale_operation(asset, op, amount_fields)
                    if whale_operation is not None:
                        whale_operations.append(whale_operation)

        return {"whale_operations": whale_operations}


def _whale_operation(threshold: Asset, op: OpBodyTransactionPair, amount_fields: tuple[str, ...]) -> WhaleAlertPair | None:
    operation: Mapping[str, object] = op["operation"]
    for field in amount_fields:
        # Operation bodies are JSON (as in TS) - the amount is an asset in the NAI form, delivered as it is.
        amount = operation[field]
        if is_asset_greater_than(threshold, amount):
            return {
                "operation": {"from": str(operation["from"]), "to": str(operation["to"]), "amount": amount},
                "transaction": op["transaction"],
            }
    return None
