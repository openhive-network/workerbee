from __future__ import annotations

from typing import Any

from ..classifier_results import RcAccountClassifierData
from .collector_classifier_base import CollectorClassifierBase, TRegisterEvaluationContext


class RcAccountClassifier(CollectorClassifierBase[RcAccountClassifierData]):
    """IRcAccountData:
      rc_accounts: dict[str, IRcAccount]

    IRcAccount:
      name: str
      rc_manabar: IMaxManabarData  {current_mana, last_update_time, max}
    """

    @classmethod
    def for_options(cls, options: dict[str, Any]) -> TRegisterEvaluationContext:
        return {"class": cls, "options": options}
