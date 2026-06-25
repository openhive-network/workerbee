"""VoteFilter — matches vote_operation from specified voters.

Mirrors src/chain-observers/filters/vote-filter.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class VoteFilter(FilterBase):
    def __init__(self, accounts: list[str]) -> None:
        super().__init__()
        self.accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        vote_ops = operations_per_type.get("vote_operation")
        if vote_ops is None:
            return False

        return any(entry["operation"]["voter"] in self.accounts for entry in vote_ops)
