from __future__ import annotations

from ..classifier_results import DynamicGlobalPropertiesData
from .collector_classifier_base import CollectorClassifierBase


class DynamicGlobalPropertiesClassifier(CollectorClassifierBase[DynamicGlobalPropertiesData]):
    """IDynamicGlobalPropertiesData:
    head_block_number: int
    current_witness: str
    head_block_time: datetime
    head_block_id: str
    downvote_pool_percent: float
    """

    pass
