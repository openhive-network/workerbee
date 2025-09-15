from __future__ import annotations

from dataclasses import dataclass

from workerbee.chain_observers.classifiers.block_header_classifier import (
    BlockHeaderData,
    BlockHeaderClassifier,
)
from workerbee.chain_observers.classifiers.block_classifier import (
    BlockData,
    BlockClassifier,
)
from workerbee.chain_observers.classifiers.collector_classifier_base import (
    RegisterEvaluationContextT,
)
from workerbee.chain_observers.factories.data_evaluation_context import (
    ProviderEvaluationContext,
)
from workerbee.chain_observers.providers.provider_base import ProviderBase


@dataclass
class _BlockProviderData(BlockHeaderData, BlockData): ...


@dataclass
class BlockProviderData:
    block: _BlockProviderData


class BlockProvider(ProviderBase):
    def used_contexts(self) -> list[RegisterEvaluationContextT]:
        return [BlockHeaderClassifier, BlockClassifier]

    async def provide(self, data: ProviderEvaluationContext) -> BlockProviderData:
        block_header = await data.get(BlockHeaderClassifier)
        block = await data.get(BlockClassifier)
        return BlockProviderData(
            block=_BlockProviderData(**block_header.__dict__, **block.__dict__)
        )
