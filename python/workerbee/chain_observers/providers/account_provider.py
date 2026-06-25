"""AccountProvider — provides account data for requested accounts.

Mirrors src/chain-observers/providers/account-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.account_classifier import AccountClassifier
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import AccountData, AccountsPayload


class AccountProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: Any) -> None:
        for account in options["accounts"]:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        contexts: list[TRegisterEvaluationContext] = []
        for account in self.accounts:
            contexts.append(AccountClassifier.for_options({"account": account}))
        return contexts

    async def provide(self, data: DataEvaluationContext) -> AccountsPayload:
        accounts_data = await data.get(AccountClassifier)
        source = accounts_data["accounts"]

        accounts: dict[str, AccountData | None] = {}
        for account in self.accounts:
            accounts[account] = source.get(account)

        return {"accounts": accounts}
