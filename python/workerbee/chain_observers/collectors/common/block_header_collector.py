"""BlockHeaderCollector — derives block header from DynamicGlobalPropertiesClassifier.

Mirrors src/chain-observers/collectors/common/block-header-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.block_header_classifier import BlockHeaderClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class BlockHeaderCollector(CollectorBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [DynamicGlobalPropertiesClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)

        return {
            BlockHeaderClassifier.__name__: {
                "number": dgp["head_block_number"],
                "timestamp": dgp["head_block_time"],
                "witness": dgp["current_witness"],
                "id": dgp["head_block_id"],
            },
        }
