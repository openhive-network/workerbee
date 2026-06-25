from __future__ import annotations

from ..classifier_results import ImpactedAccountClassifierData
from .collector_classifier_base import CollectorClassifierBase


class ImpactedAccountClassifier(CollectorClassifierBase[ImpactedAccountClassifierData]):
    """IImpactedAccountData:
      impacted_accounts: dict[str, IImpactedAccount]

    IImpactedAccount:
      name: str
      operations: list[IOperationTransactionPair]
    """

    pass
