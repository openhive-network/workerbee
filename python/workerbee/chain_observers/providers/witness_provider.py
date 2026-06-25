"""WitnessProvider — provides witness data for tracked accounts.

Mirrors src/chain-observers/providers/witness-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.witness_classifier import WitnessClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import WitnessData, WitnessesPayload


class WitnessProvider(ProviderBase):
    def __init__(self) -> None:
        self.witnesses: OrderedSet[str] = OrderedSet()

    def push_options(self, options: Any) -> None:
        for account in options["accounts"]:
            self.witnesses.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        classifiers: list[TRegisterEvaluationContext] = []
        for witness in self.witnesses:
            classifiers.append(
                WitnessClassifier.for_options({"witness": witness}),
            )
        return classifiers

    async def provide(self, data: DataEvaluationContext) -> WitnessesPayload:
        witness_data = await data.get(WitnessClassifier)
        source = witness_data["witnesses"]

        witnesses: dict[str, WitnessData | None] = {}
        for witness in self.witnesses:
            witnesses[witness] = source.get(witness)

        return {"witnesses": witnesses}
