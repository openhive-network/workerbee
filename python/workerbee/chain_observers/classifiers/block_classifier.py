from __future__ import annotations

from ..classifier_results import BlockClassifierData
from .collector_classifier_base import CollectorClassifierBase


class BlockClassifier(CollectorClassifierBase[BlockClassifierData]):
    """IBlockData:
    transactions: list[ITransactionData]  — each has {transaction, id}
    transactions_per_id: dict[str, transaction]
    """

    pass
