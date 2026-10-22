"""DynamicGlobalPropertiesCollector (HistoryData) — derives DGP from BlockHeaderClassifier.

Mirrors src/chain-observers/collectors/historydata/dynamic-global-properties-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...classifier_results import DynamicGlobalPropertiesData
from ...classifiers.block_header_classifier import BlockHeaderClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ..collector_base import CollectorBase, TCollectorResult

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class HistoryDataDynamicGlobalPropertiesCollector(CollectorBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [BlockHeaderClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> TCollectorResult:
        header = await data.get(BlockHeaderClassifier)

        return {
            DynamicGlobalPropertiesClassifier: DynamicGlobalPropertiesData(
                head_block_number=header["number"],
                current_witness=header["witness"],
                head_block_time=header["timestamp"],
                head_block_id=header["id"],
                downvote_pool_percent=0,
            ),
        }
