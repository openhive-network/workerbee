from __future__ import annotations

from ..classifier_results import FeedPriceClassifierData
from .collector_classifier_base import CollectorClassifierBase


class FeedPriceClassifier(CollectorClassifierBase[FeedPriceClassifierData]):
    """IFeedPriceData:
    current_median_history: price
    market_median_history: price
    current_min_history: price
    current_max_history: price
    last_feed_price_retrieval_timestamp: datetime
    price_history: list[price]
    """

    pass
