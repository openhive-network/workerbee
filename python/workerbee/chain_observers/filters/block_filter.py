"""BlockNumberFilter — matches a specific block number.

Mirrors src/chain-observers/filters/block-filter.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class BlockNumberFilter(FilterBase):
    def __init__(self, number: int) -> None:
        super().__init__()
        self._number = number

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.block_header_classifier import BlockHeaderClassifier

        return [BlockHeaderClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.block_header_classifier import BlockHeaderClassifier

        block = await data.get(BlockHeaderClassifier)

        return bool(block["number"] == self._number)
