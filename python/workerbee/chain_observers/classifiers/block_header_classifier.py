from __future__ import annotations

from dataclasses import dataclass

from schemas.fields.hive_datetime import HiveDateTime

from workerbee.chain_observers.classifiers.collector_classifier_base import (
    CollectorClassifierBase,
)


@dataclass
class BlockHeaderData:
    timestamp: HiveDateTime
    witness: str
    number: str
    id: str


class BlockHeaderClassifier(CollectorClassifierBase[BlockHeaderData]):
    name = "block_header_classifier"
