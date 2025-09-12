from __future__ import annotations

from dataclasses import dataclass

from wax.proto.transaction import transaction

from workerbee.chain_observers.classifiers.collector_classifier_base import (
    CollectorClassifierBase,
)


@dataclass
class TransactionData:
    transaction: transaction
    id: str


@dataclass
class BlockData:
    transactions: list[TransactionData]
    transactions_per_id: dict[str, TransactionData]


class BlockClassifier(CollectorClassifierBase[BlockData]):
    name = "block_classifier"
