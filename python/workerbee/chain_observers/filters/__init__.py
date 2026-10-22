"""Filter classes for the chain observer pipeline."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..._lazy_import import lazy_getattr

if TYPE_CHECKING:
    from .account_created_filter import AccountCreatedFilter
    from .account_full_manabar_filter import AccountFullManabarFilter
    from .account_metadata_change_filter import AccountMetadataChangeFilter
    from .alarm_filter import AlarmFilter
    from .balance_change_filter import BalanceChangeFilter
    from .blank_filter import BlankFilter
    from .block_filter import BlockNumberFilter
    from .blog_content_filter import BlogContentFilter, CommentFilter, PostFilter
    from .composite_filter import LogicalAndFilter, LogicalOrFilter
    from .content_metadata_filter import BlogContentMetadataFilter, CommentMetadataFilter, PostMetadataFilter
    from .custom_operation_filter import CustomOperationFilter
    from .exchange_transfer_filter import ExchangeTransferFilter
    from .feed_price_change_percent_filter import FeedPriceChangeFilter
    from .feed_price_no_change_filter import FeedPriceNoChangeFilter
    from .filter_base import FilterBase
    from .follow_filter import FollowFilter
    from .impacted_account_filter import ImpactedAccountFilter
    from .internal_market_filter import InternalMarketFilter
    from .new_block_filter import BlockChangedFilter
    from .post_mention_filter import PostMentionFilter
    from .reblog_filter import ReblogFilter
    from .transaction_id_filter import TransactionIdFilter
    from .vote_filter import VoteFilter
    from .whale_alert_filter import WhaleAlertFilter
    from .witness_miss_block_filter import WitnessMissedBlocksFilter

__all__ = [
    "AccountCreatedFilter",
    "AccountFullManabarFilter",
    "AccountMetadataChangeFilter",
    "AlarmFilter",
    "BalanceChangeFilter",
    "BlankFilter",
    "BlockChangedFilter",
    "BlockNumberFilter",
    "BlogContentFilter",
    "BlogContentMetadataFilter",
    "CommentFilter",
    "CommentMetadataFilter",
    "CustomOperationFilter",
    "ExchangeTransferFilter",
    "FeedPriceChangeFilter",
    "FeedPriceNoChangeFilter",
    "FilterBase",
    "FollowFilter",
    "ImpactedAccountFilter",
    "InternalMarketFilter",
    "LogicalAndFilter",
    "LogicalOrFilter",
    "PostFilter",
    "PostMentionFilter",
    "PostMetadataFilter",
    "ReblogFilter",
    "TransactionIdFilter",
    "VoteFilter",
    "WhaleAlertFilter",
    "WitnessMissedBlocksFilter",
]

# Loaded on first access - only the classes a subscription uses are imported.
__getattr__ = lazy_getattr(
    globals(),
    {
        "AccountCreatedFilter": ".account_created_filter",
        "AccountFullManabarFilter": ".account_full_manabar_filter",
        "AccountMetadataChangeFilter": ".account_metadata_change_filter",
        "AlarmFilter": ".alarm_filter",
        "BalanceChangeFilter": ".balance_change_filter",
        "BlankFilter": ".blank_filter",
        "BlockChangedFilter": ".new_block_filter",
        "BlockNumberFilter": ".block_filter",
        "BlogContentFilter": ".blog_content_filter",
        "BlogContentMetadataFilter": ".content_metadata_filter",
        "CommentFilter": ".blog_content_filter",
        "CommentMetadataFilter": ".content_metadata_filter",
        "CustomOperationFilter": ".custom_operation_filter",
        "ExchangeTransferFilter": ".exchange_transfer_filter",
        "FeedPriceChangeFilter": ".feed_price_change_percent_filter",
        "FeedPriceNoChangeFilter": ".feed_price_no_change_filter",
        "FilterBase": ".filter_base",
        "FollowFilter": ".follow_filter",
        "ImpactedAccountFilter": ".impacted_account_filter",
        "InternalMarketFilter": ".internal_market_filter",
        "LogicalAndFilter": ".composite_filter",
        "LogicalOrFilter": ".composite_filter",
        "PostFilter": ".blog_content_filter",
        "PostMentionFilter": ".post_mention_filter",
        "PostMetadataFilter": ".content_metadata_filter",
        "ReblogFilter": ".reblog_filter",
        "TransactionIdFilter": ".transaction_id_filter",
        "VoteFilter": ".vote_filter",
        "WhaleAlertFilter": ".whale_alert_filter",
        "WitnessMissedBlocksFilter": ".witness_miss_block_filter",
    },
)
