"""DeclineVotingRightsCollector — fetches decline voting rights requests."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from ..set_managed_collector import SetManagedCollector

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class DeclineVotingRightsCollector(SetManagedCollector):
    _options_key = "decline_voting_rights_account"

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        if not self._tracked:
            return {DeclineVotingRightsClassifier.__name__: {"decline_voting_rights_accounts": {}}}

        accounts: dict[str, Any] = {}
        for chunk in self._tracked_chunks():
            with data.add_timing("database_api.find_decline_voting_rights_requests"):
                result = await self.worker.chain.api.database_api.find_decline_voting_rights_requests(
                    accounts=chunk,
                )

            for req in result.requests:
                accounts[req.account] = {
                    "account": req.account,
                    "effective_date": req.effective_date,
                }

        return {DeclineVotingRightsClassifier.__name__: {"decline_voting_rights_accounts": accounts}}
