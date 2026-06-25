"""WhaleAlertProvider — provides large transfer operations exceeding asset thresholds.

Mirrors src/chain-observers/providers/whale-alert-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from ..utils import is_asset_greater_than
from ._transfer_helpers import TRANSFER_OP_TYPES, get_transfer_amount
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import WhaleAlertPair, WhaleAlertPayload

AssetThreshold = dict[str, int | str]
WhaleAlertOptions = dict[str, list[AssetThreshold]]


class WhaleAlertProvider(ProviderBase):
    def __init__(self) -> None:
        self.assets: dict[str, AssetThreshold] = {}

    def push_options(self, options: WhaleAlertOptions) -> None:
        for asset in options.get("assets", []):
            self.assets[str(asset["nai"])] = asset

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> WhaleAlertPayload:
        operations = await data.get(OperationClassifier)
        ops_per_type = operations["operations_per_type"]

        whale_operations: list[WhaleAlertPair] = []

        for asset in self.assets.values():
            for op_type in TRANSFER_OP_TYPES:
                ops = ops_per_type.get(op_type)
                if not ops:
                    continue

                for op in ops:
                    amount = get_transfer_amount(op, op_type)
                    if amount and is_asset_greater_than(asset, amount):
                        operation = op["operation"]
                        whale_operations.append(
                            cast(
                                "WhaleAlertPair",
                                {
                                    "operation": {
                                        "from": operation["from"],
                                        "to": operation["to"],
                                        "amount": amount,
                                    },
                                    "transaction": op["transaction"],
                                },
                            )
                        )
                    if op_type == "escrow_transfer_operation":
                        esc_op = op["operation"]
                        hive_amount = esc_op.get("hive_amount")
                        if hive_amount and hive_amount != amount and is_asset_greater_than(asset, hive_amount):
                            whale_operations.append(
                                cast(
                                    "WhaleAlertPair",
                                    {
                                        "operation": {
                                            "from": esc_op["from"],
                                            "to": esc_op["to"],
                                            "amount": hive_amount,
                                        },
                                        "transaction": op["transaction"],
                                    },
                                )
                            )

        return {"whale_operations": whale_operations}
