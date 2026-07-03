from __future__ import annotations

from typing import Any

from ..classifier_results import ManabarClassifierData
from .collector_classifier_base import CollectorClassifierBase, TRegisterEvaluationContext


class ManabarClassifier(CollectorClassifierBase[ManabarClassifierData]):
    """Collect account manabar data.

    Mirrors the TypeScript ``IManabarAccountData`` shape::

        IManabarAccountData:
            manabar_data: dict[str, TManabars]

        TManabars = dict[ManabarType, IManabarDataPercent]
        IManabarDataPercent:
            current_mana: int
            last_update_time: datetime
            max: int
            percent: float
    """

    @classmethod
    def for_options(cls, options: dict[str, Any]) -> TRegisterEvaluationContext:
        return {"class": cls, "options": options}
