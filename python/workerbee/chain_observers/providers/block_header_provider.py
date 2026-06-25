"""BlockHeaderProvider — provides block header data.

Mirrors src/chain-observers/providers/block-header-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..classifiers.block_header_classifier import BlockHeaderClassifier
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import BlockHeaderData, BlockHeaderPayload


class BlockHeaderProvider(ProviderBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [BlockHeaderClassifier]

    async def provide(self, data: DataEvaluationContext) -> BlockHeaderPayload:
        block_header = await data.get(BlockHeaderClassifier)

        return {
            "block": cast("BlockHeaderData", {**block_header}),
        }
