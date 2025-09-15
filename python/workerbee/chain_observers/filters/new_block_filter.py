from __future__ import annotations

from workerbee.bot import WorkerBee
from workerbee.chain_observers.factories.data_evaluation_context import (
    FilterEvaluationContext,
)
from workerbee.chain_observers.filters.filter_base import FilterBase
from workerbee.chain_observers.classifiers.block_header_classifier import (
    BlockHeaderClassifier,
)


class BlockChangedFilter(FilterBase):
    def __init__(self, worker: WorkerBee):
        super().__init__(worker)
        self._previous_block_num: int | None = None

    def used_contexts(  # type : ignore[override]  # Must be fixed.
        self,
    ) -> list[type[BlockHeaderClassifier]]:
        return [BlockHeaderClassifier]

    async def match(self, data: FilterEvaluationContext) -> bool:
        block = await data.get(
            BlockHeaderClassifier  # type : ignore[arg-typ]  # Must be fixed.
        )

        assert block is not None, (
            "Block should never be None here."
        )  # This assertion probably can be removed.
        block_changed = block.number != self._previous_block_num
        self._previous_block_num = block.number

        return block_changed
