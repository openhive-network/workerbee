from __future__ import annotations

from typing import TYPE_CHECKING

from ..classifier_results import ChangeRecoveryInProgressData
from .collector_classifier_base import ClassifierWithOptions, CollectorClassifierBase

if TYPE_CHECKING:
    from collections.abc import Mapping


class ChangeRecoveryInProgressClassifier(CollectorClassifierBase[ChangeRecoveryInProgressData]):
    """IChangeRecoveryInProgressData:
      recovering_accounts: dict[str, IAccountChangingRecovery]

    IAccountChangingRecovery:
      account_to_recover: str
      recovery_account: str
      effective_on: datetime
    """

    @classmethod
    def for_options(cls, options: Mapping[str, object]) -> ClassifierWithOptions:
        return {"class": cls, "options": options}
