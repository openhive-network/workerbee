"""Typed result shapes returned by ``DataEvaluationContext.get(...)``.

These are classifier-level payloads, not final observer notifications. Final
notification payloads remain in :mod:`workerbee.chain_observers.payloads`.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict

from .payloads import BlockTransactionsData, FeedPriceData

if TYPE_CHECKING:
    from datetime import datetime

    from hiveio_api.operations import Price

    from .payloads import (
        AccountData,
        ContentMetadata,
        ManabarValue,
        OperationsPerType,
        OperationTransactionPair,
        RcAccountData,
        WitnessData,
    )


class DynamicGlobalPropertiesData(TypedDict):
    current_witness: str
    downvote_pool_percent: int
    head_block_number: int
    head_block_time: datetime
    head_block_id: str


BlockClassifierData = BlockTransactionsData
"""The transactions of the block (the payload of ``provide_block_data()`` holds them with the header)."""


class OperationClassifierData(TypedDict):
    operations: list[OperationTransactionPair]
    operations_per_type: OperationsPerType


class ImpactedAccountData(TypedDict):
    name: str
    operations: list[OperationTransactionPair]


class ImpactedAccountClassifierData(TypedDict):
    impacted_accounts: dict[str, ImpactedAccountData]


class AccountClassifierData(TypedDict):
    accounts: dict[str, AccountData | None]


class RcAccountClassifierData(TypedDict):
    rc_accounts: dict[str, RcAccountData | None]


class WitnessClassifierData(TypedDict):
    witnesses: dict[str, WitnessData | None]


class ManabarClassifierData(TypedDict):
    manabar_data: dict[str, dict[int, ManabarValue]]


class AccountRecoveryChangeData(TypedDict):
    account_to_recover: str
    recovery_account: str
    effective_on: datetime


class ChangeRecoveryInProgressData(TypedDict):
    recovering_accounts: dict[str, AccountRecoveryChangeData]


class DeclinedVotingRightsData(TypedDict):
    account: str
    effective_date: datetime


class DeclineVotingRightsData(TypedDict):
    decline_voting_rights_accounts: dict[str, DeclinedVotingRightsData]


class ContentMetadataClassifierData(TypedDict):
    content_data: dict[str, dict[str, ContentMetadata]]


class FeedPriceClassifierData(FeedPriceData):
    """The feed price data of the provider (``FeedPriceData``) and the data only filters use."""

    market_median_history: Price
    last_feed_price_retrieval_timestamp: datetime
