"""ImpactedAccountFilter — matches when specified accounts are impacted.

Mirrors src/chain-observers/filters/impacted-account-filter.ts.

Uses ImpactedAccountClassifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class ImpactedAccountFilter(FilterBase):
    def __init__(self, accounts: list[str]) -> None:
        super().__init__()
        self._accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.impacted_account_classifier import ImpactedAccountClassifier

        return [ImpactedAccountClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.impacted_account_classifier import ImpactedAccountClassifier

        result = await data.get(ImpactedAccountClassifier)

        return any(result["impacted_accounts"].get(account) is not None for account in self._accounts)
