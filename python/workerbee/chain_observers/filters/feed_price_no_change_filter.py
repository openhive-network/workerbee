"""FeedPriceNoChangeFilter — TS-compatible legacy feed-price window filter.

Mirrors src/chain-observers/filters/feed-price-no-change-filter.ts.

Uses FeedPriceClassifier. In standard configuration one interval is one hour,
so the default 24 intervals is one day.

Despite the legacy public name, the TypeScript implementation returns ``true``
when it finds a price change inside the trailing window. Python keeps that
behavior for source-of-truth compatibility.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class FeedPriceNoChangeFilter(FilterBase):
    def __init__(self, feed_price_no_change_intervals: float = 24) -> None:
        super().__init__()
        self._feed_price_no_change_intervals = feed_price_no_change_intervals
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

        previous_price: int | None = None
        index = 0
        price_changed = False

        for entry in price_history:
            price = int(entry.base.amount) // int(entry.quote.amount)

            if previous_price is None:
                previous_price = price
                continue

            if previous_price != price:
                price_changed = True
                break

            index += 1
            if index >= self._feed_price_no_change_intervals:
                break

        return price_changed
