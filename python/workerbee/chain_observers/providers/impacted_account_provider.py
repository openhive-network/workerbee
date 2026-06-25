"""ImpactedAccountProvider — provides operations that impact tracked accounts.

Mirrors src/chain-observers/providers/impacted-account-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.impacted_account_classifier import ImpactedAccountClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import ImpactedAccountsPayload, OperationTransactionPair


class ImpactedAccountProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: Any) -> None:
        for account in options["accounts"]:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [ImpactedAccountClassifier]

    async def provide(self, data: DataEvaluationContext) -> ImpactedAccountsPayload:
        impacted_data = await data.get(ImpactedAccountClassifier)
        impacted_accounts = impacted_data["impacted_accounts"]

        result: dict[str, list[OperationTransactionPair]] = {}
        for account in self.accounts:
            entry = impacted_accounts.get(account)
            if entry is not None:
                result[account] = list(entry["operations"])

        return {"impacted_accounts": result}
