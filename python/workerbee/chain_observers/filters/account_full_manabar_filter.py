"""AccountFullManabarFilter — returns True when manabar >= threshold or max == 0.

Mirrors src/chain-observers/filters/account-full-manabar-filter.ts.

Uses ManabarClassifier.for_options.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class AccountFullManabarFilter(FilterBase):
    def __init__(
        self,
        accounts: list[str],
        manabar_type: int,
        manabar_load_percent: float = 98,
    ) -> None:
        super().__init__()
        self._manabar_type = manabar_type
        self._manabar_load_percent = manabar_load_percent
        self.accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.manabar_classifier import ManabarClassifier

        context: list[TRegisterEvaluationContext] = []

        for account in self.accounts:
            context.append(
                ManabarClassifier.for_options(
                    {"account": account, "manabar_type": self._manabar_type},
                ),
            )

        return context

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.manabar_classifier import ManabarClassifier

        result = await data.get(ManabarClassifier)
        manabar_data = result["manabar_data"]

        for account in self.accounts:
            account_data = manabar_data.get(account)
            if account_data is None:
                continue

            manabar = account_data.get(self._manabar_type)
            if manabar is None:
                continue

            if manabar["max"] == 0:
                return True

            if manabar["percent"] >= self._manabar_load_percent:
                return True

        return False
