"""FeedPriceCollector — fetches feed history via database_api.get_feed_history.

Caches results and only refetches when a HIVE_FEED_INTERVAL_BLOCKS boundary
is crossed between the previously checked block and the current head block.
Mirrors src/chain-observers/collectors/jsonrpc/feed-price-collector.ts.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ...classifiers.feed_price_classifier import FeedPriceClassifier
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...interfaces import IWorkerBee

FeedPriceData = dict[str, object]


def _is_divisible_by_in_range(by: int, start: int, end: int) -> bool:
    first_multiple = math.ceil(start / by) * by
    return first_multiple <= end


class FeedPriceCollector(CollectorBase):
    def __init__(self, worker: IWorkerBee) -> None:
        super().__init__(worker)
        self._cached_data: FeedPriceData | None = None
        self._previously_checked_block_number = 0

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [DynamicGlobalPropertiesClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        head_block_number: int = dgp["head_block_number"]

        feed_interval_blocks = int(self.worker.chain.config["HIVE_FEED_INTERVAL_BLOCKS"])
        should_fetch = self._cached_data is None or _is_divisible_by_in_range(
            feed_interval_blocks,
            self._previously_checked_block_number,
            head_block_number,
        )

        if should_fetch:
            with data.add_timing("database_api.get_feed_history"):
                result = await self.worker.chain.api.database_api.get_feed_history()

            price_history = list(reversed(result.price_history))
            current_median = result.current_median_history
            current_min = result.current_min_history
            current_max = result.current_max_history
            market_median = result.market_median_history

            self._cached_data = {
                "current_median_history": current_median,
                "market_median_history": market_median,
                "current_min_history": current_min,
                "current_max_history": current_max,
                "last_feed_price_retrieval_timestamp": datetime.now(UTC),
                "price_history": price_history,
            }

        self._previously_checked_block_number = head_block_number

        return {FeedPriceClassifier.__name__: self._cached_data}
