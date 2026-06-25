"""ChangeRecoveryInProgressCollector — fetches recovery account change requests."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from ..set_managed_collector import SetManagedCollector

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class ChangeRecoveryInProgressCollector(SetManagedCollector):
    _options_key = "change_recovery_account"

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        if not self._tracked:
            return {ChangeRecoveryInProgressClassifier.__name__: {"recovering_accounts": {}}}

        recovering: dict[str, Any] = {}
        for chunk in self._tracked_chunks():
            with data.add_timing("database_api.find_change_recovery_account_requests"):
                result = await self.worker.chain.api.database_api.find_change_recovery_account_requests(
                    accounts=chunk,
                )

            for req in result.requests:
                recovering[req.account_to_recover] = {
                    "account_to_recover": req.account_to_recover,
                    "recovery_account": req.recovery_account,
                    "effective_on": req.effective_on,
                }

        return {ChangeRecoveryInProgressClassifier.__name__: {"recovering_accounts": recovering}}
