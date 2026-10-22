from __future__ import annotations

from typing import TYPE_CHECKING

from ..classifier_results import DeclineVotingRightsData
from .collector_classifier_base import ClassifierWithOptions, CollectorClassifierBase

if TYPE_CHECKING:
    from collections.abc import Mapping


class DeclineVotingRightsClassifier(CollectorClassifierBase[DeclineVotingRightsData]):
    """IDeclineVotingRightsAccountsData:
      decline_voting_rights_accounts: dict[str, IDeclinedVotingRightsAccount]

    IDeclinedVotingRightsAccount:
      account: str
      effective_date: datetime
    """

    @classmethod
    def for_options(cls, options: Mapping[str, object]) -> ClassifierWithOptions:
        return {"class": cls, "options": options}
