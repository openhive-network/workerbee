from __future__ import annotations

from typing import Any

from ..classifier_results import WitnessClassifierData
from .collector_classifier_base import CollectorClassifierBase, TRegisterEvaluationContext


class WitnessClassifier(CollectorClassifierBase[WitnessClassifierData]):
    """IWitnessData:
      witnesses: dict[str, IWitness]

    IWitness:
      owner: str
      running_version: str
      total_missed_blocks: int
      last_confirmed_block_num: int
    """

    @classmethod
    def for_options(cls, options: dict[str, Any]) -> TRegisterEvaluationContext:
        return {"class": cls, "options": options}
