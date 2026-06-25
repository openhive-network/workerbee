"""TransactionIdFilter — matches transactions by their ID.

Mirrors src/chain-observers/filters/transaction-id-filter.ts.

Uses BlockClassifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class TransactionIdFilter(FilterBase):
    def __init__(self, transaction_ids: list[str]) -> None:
        super().__init__()
        self._transaction_ids: OrderedSet[str] = OrderedSet(transaction_ids)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.block_classifier import BlockClassifier

        return [BlockClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.block_classifier import BlockClassifier

        block = await data.get(BlockClassifier)

        return any(transaction_id in block["transactions_per_id"] for transaction_id in self._transaction_ids)
