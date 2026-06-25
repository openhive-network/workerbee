"""DynamicGlobalPropertiesCollector — fetches DGPO via database_api.

Mirrors src/chain-observers/collectors/jsonrpc/dynamic-global-properties-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ...utils import parse_iso_timestamp
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class DynamicGlobalPropertiesCollector(CollectorBase):
    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        with data.add_timing("database_api.get_dynamic_global_properties"):
            dgpo = await self.worker.chain.api.database_api.get_dynamic_global_properties()

        return {
            DynamicGlobalPropertiesClassifier.__name__: {
                "current_witness": dgpo.current_witness,
                "downvote_pool_percent": dgpo.downvote_pool_percent,
                "head_block_number": dgpo.head_block_number,
                "head_block_time": parse_iso_timestamp(str(dgpo.time)),
                "head_block_id": dgpo.head_block_id,
            },
        }
