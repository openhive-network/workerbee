"""FeedPriceChangeFilter — stateful, fires when feed price changes by a percentage.

Mirrors src/chain-observers/filters/feed-price-change-percent-filter.ts.

Uses FeedPriceClassifier.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class FeedPriceChangeFilter(FilterBase):
    def __init__(self, feed_price_change_percent_min: float) -> None:
        super().__init__()
        self._feed_price_change_percent_min = feed_price_change_percent_min
        self._previous_update_timestamp: datetime | None = None

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.feed_price_classifier import FeedPriceClassifier

        return [FeedPriceClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.feed_price_classifier import FeedPriceClassifier

        result = await data.get(FeedPriceClassifier)
        price_history = result["price_history"]
        last_timestamp = result["last_feed_price_retrieval_timestamp"]

        if self._previous_update_timestamp and self._previous_update_timestamp > last_timestamp:
            return False

        history = list(price_history)
        if len(history) < 2:
            return False

        price1 = int(history[0].base.amount) / int(history[0].quote.amount)
        price2 = int(history[1].base.amount) / int(history[1].quote.amount)

        # Avoid division by zero
        if price2 == 0:
            return False

        percent_change = abs(price1 - price2) / price2 * 100

        self._previous_update_timestamp = last_timestamp

        return percent_change >= self._feed_price_change_percent_min
