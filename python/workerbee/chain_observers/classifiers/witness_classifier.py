from __future__ import annotations

from typing import TYPE_CHECKING

from ..classifier_results import WitnessClassifierData
from .collector_classifier_base import ClassifierWithOptions, CollectorClassifierBase

if TYPE_CHECKING:
    from collections.abc import Mapping


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
    def for_options(cls, options: Mapping[str, object]) -> ClassifierWithOptions:
        return {"class": cls, "options": options}
