from __future__ import annotations

from dataclasses import dataclass

from workerbee.chain_observers.classifiers.block_header_classifier import (
    BlockHeaderClassifier,
    BlockHeaderData,
)
from workerbee.chain_observers.factories.data_evaluation_context import (
    ProviderEvaluationContext,
)
from workerbee.chain_observers.providers.provider_base import ProviderBase


@dataclass
class BlockHeaderProviderData:
    block: BlockHeaderData


class BlockHeaderProvider(ProviderBase):
    def used_contexts(self) -> list[type[BlockHeaderClassifier]]:
        return [BlockHeaderClassifier]

    async def provide(self, data: ProviderEvaluationContext) -> BlockHeaderProviderData:
        block_header = await data.get(BlockHeaderClassifier)
        assert block_header is not None, (
            "BlockHeaderClassifier is required by BlockHeaderProvider"
        )
        return BlockHeaderProviderData(block=block_header)
