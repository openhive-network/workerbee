"""RcAccountCollector — fetches RC data via rc_api.find_rc_accounts."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.rc_account_classifier import RcAccountClassifier
from ..set_managed_collector import SetManagedCollector

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class RcAccountCollector(SetManagedCollector):
    _options_key = "rc_account"

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        if not self._tracked:
            return {RcAccountClassifier.__name__: {"rc_accounts": {}}}

        rc_accounts: dict[str, Any] = {}
        for chunk in self._tracked_chunks():
            with data.add_timing("rc_api.find_rc_accounts"):
                result = await self.worker.chain.api.rc_api.find_rc_accounts(accounts=chunk)

            for acc in result.rc_accounts:
                name = acc.account
                rc_accounts[name] = {
                    "name": name,
                    # ``max_rc`` lives on the RcAccount, not inside rc_manabar, so fold it
                    # into the manabar dict where ManabarCollector reads it (TS IRcAccount).
                    "rc_manabar": {
                        "current_mana": acc.rc_manabar.current_mana,
                        "max_rc": acc.max_rc,
                        "last_update_time": acc.rc_manabar.last_update_time,
                    },
                }

        return {RcAccountClassifier.__name__: {"rc_accounts": rc_accounts}}
