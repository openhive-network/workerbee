"""Provider classes for the chain observer pipeline."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..._lazy_import import lazy_getattr

if TYPE_CHECKING:
    from .account_provider import AccountProvider
    from .alarm_provider import AlarmProvider, AlarmType
    from .block_header_provider import BlockHeaderProvider
    from .block_provider import BlockProvider
    from .comment_provider import CommentProvider
    from .content_metadata_provider import CommentMetadataProvider, ContentMetadataProviderBase, PostMetadataProvider
    from .custom_operation_provider import CustomOperationProvider
    from .exchange_transfer_provider import ExchangeTransferProvider
    from .feed_price_provider import FeedPriceProvider
    from .follow_provider import FollowProvider
    from .impacted_account_provider import ImpactedAccountProvider
    from .internal_market_provider import InternalMarketProvider
    from .manabar_provider import ManabarProvider
    from .mention_provider import MentionedAccountProvider
    from .new_account_provider import NewAccountProvider
    from .post_provider import PostProvider
    from .provider_base import ProviderBase
    from .rc_account_provider import RcAccountProvider
    from .reblog_provider import ReblogProvider
    from .transaction_provider import TransactionByIdProvider
    from .vote_provider import VoteProvider
    from .whale_alert_provider import WhaleAlertProvider
    from .witness_provider import WitnessProvider

__all__ = [
    "AccountProvider",
    "AlarmProvider",
    "AlarmType",
    "BlockHeaderProvider",
    "BlockProvider",
    "CommentMetadataProvider",
    "CommentProvider",
    "ContentMetadataProviderBase",
    "CustomOperationProvider",
    "ExchangeTransferProvider",
    "FeedPriceProvider",
    "FollowProvider",
    "ImpactedAccountProvider",
    "InternalMarketProvider",
    "ManabarProvider",
    "MentionedAccountProvider",
    "NewAccountProvider",
    "PostMetadataProvider",
    "PostProvider",
    "ProviderBase",
    "RcAccountProvider",
    "ReblogProvider",
    "TransactionByIdProvider",
    "VoteProvider",
    "WhaleAlertProvider",
    "WitnessProvider",
]

# Loaded on first access - only the classes a subscription uses are imported.
__getattr__ = lazy_getattr(
    globals(),
    {
        "AccountProvider": ".account_provider",
        "AlarmProvider": ".alarm_provider",
        "AlarmType": ".alarm_provider",
        "BlockHeaderProvider": ".block_header_provider",
        "BlockProvider": ".block_provider",
        "CommentMetadataProvider": ".content_metadata_provider",
        "CommentProvider": ".comment_provider",
        "ContentMetadataProviderBase": ".content_metadata_provider",
        "CustomOperationProvider": ".custom_operation_provider",
        "ExchangeTransferProvider": ".exchange_transfer_provider",
        "FeedPriceProvider": ".feed_price_provider",
        "FollowProvider": ".follow_provider",
        "ImpactedAccountProvider": ".impacted_account_provider",
        "InternalMarketProvider": ".internal_market_provider",
        "ManabarProvider": ".manabar_provider",
        "MentionedAccountProvider": ".mention_provider",
        "NewAccountProvider": ".new_account_provider",
        "PostMetadataProvider": ".content_metadata_provider",
        "PostProvider": ".post_provider",
        "ProviderBase": ".provider_base",
        "RcAccountProvider": ".rc_account_provider",
        "ReblogProvider": ".reblog_provider",
        "TransactionByIdProvider": ".transaction_provider",
        "VoteProvider": ".vote_provider",
        "WhaleAlertProvider": ".whale_alert_provider",
        "WitnessProvider": ".witness_provider",
    },
)
