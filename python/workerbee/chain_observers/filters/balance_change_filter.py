"""BalanceChangeFilter — stateful, tracks previous balance.

Mirrors src/chain-observers/filters/balance-change-filter.ts.

Uses AccountClassifier.for_options.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class BalanceChangeFilter(FilterBase):
    def __init__(
        self,
        accounts: list[str],
        include_internal_transfers: bool = False,
    ) -> None:
        super().__init__()
        self._include_internal_transfers = include_internal_transfers
        self._accounts: OrderedSet[str] = OrderedSet(accounts)
        self._previous_balance_by_account: dict[str, Any] = {}

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.account_classifier import AccountClassifier

        classifiers: list[TRegisterEvaluationContext] = []
        for account in self._accounts:
            classifiers.append(AccountClassifier.for_options({"account": account}))

        return classifiers

    def _parse_internal_transfers(self, account_name: str, balance: Any) -> bool:
        prev = self._previous_balance_by_account.get(account_name)
        if prev is None:
            raise RuntimeError("Cannot parse internal transfers before storing a previous balance")
        for asset_key in prev:
            for type_key in prev[asset_key]:
                if prev[asset_key][type_key].amount != balance[asset_key][type_key].amount:
                    self._previous_balance_by_account[account_name] = balance
                    return True

        self._previous_balance_by_account[account_name] = balance
        return False

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.account_classifier import AccountClassifier

        result = await data.get(AccountClassifier)
        accounts = result["accounts"]

        for account_name in self._accounts:
            account = accounts.get(account_name)

            if account is None:
                return False

            previous_balance = self._previous_balance_by_account.get(account_name)
            if previous_balance is None:
                self._previous_balance_by_account[account_name] = account["balance"]
                continue

            if self._include_internal_transfers:
                if self._parse_internal_transfers(account_name, account["balance"]):
                    return True
                continue

            changed_hp = previous_balance["HP"]["total"].amount != account["balance"]["HP"]["total"].amount
            changed_hive = previous_balance["HIVE"]["total"].amount != account["balance"]["HIVE"]["total"].amount
            changed_hbd = previous_balance["HBD"]["total"].amount != account["balance"]["HBD"]["total"].amount

            self._previous_balance_by_account[account_name] = account["balance"]

            if changed_hp or changed_hive or changed_hbd:
                return True

        return False
