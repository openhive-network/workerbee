"""RcAccountProvider — provides RC (resource credit) account data.

Mirrors src/chain-observers/providers/rc-account-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.rc_account_classifier import RcAccountClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import RcAccountData, RcAccountsPayload


class RcAccountProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: Any) -> None:
        for account in options["accounts"]:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        classifiers: list[TRegisterEvaluationContext] = []
        for rc_account in self.accounts:
            classifiers.append(
                RcAccountClassifier.for_options({"rc_account": rc_account}),
            )
        return classifiers

    async def provide(self, data: DataEvaluationContext) -> RcAccountsPayload:
        rc_data = await data.get(RcAccountClassifier)
        source = rc_data["rc_accounts"]

        rc_accounts: dict[str, RcAccountData | None] = {}
        for rc_account in self.accounts:
            rc_accounts[rc_account] = source.get(rc_account)

        return {"rc_accounts": rc_accounts}
