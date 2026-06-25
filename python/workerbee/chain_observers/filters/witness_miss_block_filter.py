"""WitnessMissedBlocksFilter — stateful, fires when a witness misses blocks.

Mirrors src/chain-observers/filters/witness-miss-block-filter.ts.

Uses WitnessClassifier.for_options.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class WitnessMissedBlocksFilter(FilterBase):
    def __init__(self, witnesses: list[str], missed_blocks_count_min: int) -> None:
        super().__init__()
        self._missed_blocks_count_min = missed_blocks_count_min
        self._witnesses: OrderedSet[str] = OrderedSet(witnesses)
        self._initial_missed_blocks_count: int | None = None
        self._previous_last_block_number: int | None = None

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.witness_classifier import WitnessClassifier

        classifiers: list[TRegisterEvaluationContext] = []
        for witness in self._witnesses:
            classifiers.append(WitnessClassifier.for_options({"witness": witness}))

        return classifiers

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.witness_classifier import WitnessClassifier

        result = await data.get(WitnessClassifier)
        witnesses = result["witnesses"]

        for witness_name in self._witnesses:
            witness = witnesses.get(witness_name)

            # If witness is not producing blocks, we do not care about missed blocks
            if witness is None:
                continue

            if self._previous_last_block_number is None:
                self._initial_missed_blocks_count = witness["total_missed_blocks"]
                self._previous_last_block_number = int(witness["last_confirmed_block_num"])
                return False

            # If witness missed more blocks than the minimum required and his last
            # signed block number has not changed (he is not producing blocks)
            last_confirmed_block_num = int(witness["last_confirmed_block_num"])
            if (
                self._previous_last_block_number == last_confirmed_block_num
                and self._initial_missed_blocks_count is not None
                and witness["total_missed_blocks"] > (self._initial_missed_blocks_count + self._missed_blocks_count_min)
            ):
                # Reset missed blocks count to avoid multiple notifications
                # for the same missed blocks streak
                self._initial_missed_blocks_count = None
                return True

            # Update the initial missed blocks count if the last signed block number
            # has changed - block missed streak reset
            if self._previous_last_block_number != last_confirmed_block_num:
                self._initial_missed_blocks_count = witness["total_missed_blocks"]

            self._previous_last_block_number = last_confirmed_block_num

        return False
