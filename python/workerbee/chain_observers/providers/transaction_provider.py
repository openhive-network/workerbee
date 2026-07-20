"""TransactionByIdProvider — provides transactions by their IDs.

Mirrors src/chain-observers/providers/transaction-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.block_classifier import BlockClassifier
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from hiveio_api.block_api import BlockTransaction

    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import TransactionsByIdPayload


class TransactionByIdProvider(ProviderBase):
    def __init__(self) -> None:
        self.transaction_ids: OrderedSet[str] = OrderedSet()

    def push_options(self, options: Any) -> None:
        for tx_id in options["transaction_ids"]:
            self.transaction_ids.add(tx_id)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [BlockClassifier]

    async def provide(self, data: DataEvaluationContext) -> TransactionsByIdPayload:
        transactions: dict[str, BlockTransaction] = {}

        block = await data.get(BlockClassifier)
        transactions_per_id = block["transactions_per_id"]
        for tx_id in self.transaction_ids:
            if tx_id in transactions_per_id:
                transactions[tx_id] = transactions_per_id[tx_id]

        return {"transactions": transactions}
