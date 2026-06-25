"""BlockChangedFilter — stateful, returns True when block number changes.

Mirrors src/chain-observers/filters/new-block-filter.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class BlockChangedFilter(FilterBase):
    def __init__(self) -> None:
        super().__init__()
        self._previous_block: int | None = None

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.block_header_classifier import BlockHeaderClassifier

        return [BlockHeaderClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.block_header_classifier import BlockHeaderClassifier

        block = await data.get(BlockHeaderClassifier)

        block_changed: bool = self._previous_block != block["number"]

        self._previous_block = block["number"]

        return block_changed
