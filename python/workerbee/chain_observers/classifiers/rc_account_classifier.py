from __future__ import annotations

from typing import TYPE_CHECKING

from ..classifier_results import RcAccountClassifierData
from .collector_classifier_base import ClassifierWithOptions, CollectorClassifierBase

if TYPE_CHECKING:
    from collections.abc import Mapping


class RcAccountClassifier(CollectorClassifierBase[RcAccountClassifierData]):
    """IRcAccountData:
      rc_accounts: dict[str, IRcAccount]

    IRcAccount:
      name: str
      rc_manabar: IMaxManabarData  {current_mana, last_update_time, max}
    """

    @classmethod
    def for_options(cls, options: Mapping[str, object]) -> ClassifierWithOptions:
        return {"class": cls, "options": options}
