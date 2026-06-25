"""FeedPriceProvider — provides feed price data.

Mirrors src/chain-observers/providers/feed-price-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.feed_price_classifier import FeedPriceClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import FeedPricePayload


class FeedPriceProvider(ProviderBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [FeedPriceClassifier]

    async def provide(self, data: DataEvaluationContext) -> FeedPricePayload:
        feed_price_data = await data.get(FeedPriceClassifier)

        return {
            "feed_price": {
                "current_median_history": feed_price_data["current_median_history"],
                "current_min_history": feed_price_data["current_min_history"],
                "current_max_history": feed_price_data["current_max_history"],
                "price_history": feed_price_data["price_history"],
            },
        }
