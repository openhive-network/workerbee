from __future__ import annotations

from ..classifier_results import OperationClassifierData
from .collector_classifier_base import CollectorClassifierBase


class OperationClassifier(CollectorClassifierBase[OperationClassifierData]):
    """IOperationData:
    operations: list[IOperationTransactionPair]
    operations_per_type: dict[str, list[IOperationTransactionPair]]
    """

    pass
