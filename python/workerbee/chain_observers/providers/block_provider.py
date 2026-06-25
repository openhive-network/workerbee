"""BlockProvider — provides merged block header + block data.

Mirrors src/chain-observers/providers/block-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..classifiers.block_classifier import BlockClassifier
from ..classifiers.block_header_classifier import BlockHeaderClassifier
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import BlockData, BlockPayload


class BlockProvider(ProviderBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [BlockHeaderClassifier, BlockClassifier]

    async def provide(self, data: DataEvaluationContext) -> BlockPayload:
        block_header = await data.get(BlockHeaderClassifier)
        block = await data.get(BlockClassifier)

        return {
            "block": cast("BlockData", {**block_header, **block}),
        }
