from __future__ import annotations

from typing import Any

from ..classifier_results import DeclineVotingRightsData
from .collector_classifier_base import CollectorClassifierBase, TRegisterEvaluationContext


class DeclineVotingRightsClassifier(CollectorClassifierBase[DeclineVotingRightsData]):
    """IDeclineVotingRightsAccountsData:
      decline_voting_rights_accounts: dict[str, IDeclinedVotingRightsAccount]

    IDeclinedVotingRightsAccount:
      account: str
      effective_date: datetime
    """

    @classmethod
    def for_options(cls, options: dict[str, Any]) -> TRegisterEvaluationContext:
        return {"class": cls, "options": options}
