from __future__ import annotations

from typing import Any

from ..classifier_results import AccountClassifierData
from .collector_classifier_base import CollectorClassifierBase, TRegisterEvaluationContext


class AccountClassifier(CollectorClassifierBase[AccountClassifierData]):
    """IAccountData:
      accounts: dict[str, IAccount]

    IAccount:
      name: str
      upvote_manabar: IMaxManabarData  {current_mana, last_update_time, max}
      downvote_manabar: IManabarData   {current_mana, last_update_time}
      posting_json_metadata: dict
      json_metadata: dict
      balance: IAccountBalance  {HBD, HIVE, HP}
      recovery_account: str
      governance_vote_expiration: datetime | None
    """

    @classmethod
    def for_options(cls, options: dict[str, Any]) -> TRegisterEvaluationContext:
        return {"class": cls, "options": options}
