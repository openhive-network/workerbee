from __future__ import annotations

from ..payloads import BlockHeaderData
from .collector_classifier_base import CollectorClassifierBase


class BlockHeaderClassifier(CollectorClassifierBase[BlockHeaderData]):
    """IBlockHeaderData:
    timestamp: datetime
    witness: str
    number: int
    id: str
    """

    pass
