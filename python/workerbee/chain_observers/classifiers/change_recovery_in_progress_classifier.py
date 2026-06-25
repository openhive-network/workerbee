from __future__ import annotations

from typing import Any

from ..classifier_results import ChangeRecoveryInProgressData
from .collector_classifier_base import CollectorClassifierBase, TRegisterEvaluationContext


class ChangeRecoveryInProgressClassifier(CollectorClassifierBase[ChangeRecoveryInProgressData]):
    """IChangeRecoveryInProgressData:
      recovering_accounts: dict[str, IAccountChangingRecovery]

    IAccountChangingRecovery:
      account_to_recover: str
      recovery_account: str
      effective_on: datetime
    """

    @classmethod
    def for_options(cls, options: dict[str, Any]) -> TRegisterEvaluationContext:
        return {"class": cls, "options": options}
