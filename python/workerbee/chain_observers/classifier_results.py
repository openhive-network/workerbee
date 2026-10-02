"""Typed result shapes returned by ``DataEvaluationContext.get(...)``.

These are classifier-level payloads, not final observer notifications. Final
notification payloads remain in :mod:`workerbee.chain_observers.payloads`.
"""

from __future__ import annotations

from datetime import datetime
from typing import TypedDict

from hiveio_api.block_api import BlockTransaction
from hiveio_api.common import PricePair
from hiveio_api.database_api import FeedPriceHistoryItem

from .payloads import (
    AccountData,
    ContentMetadata,
    ManabarValue,
    OperationsPerType,
    OperationTransactionPair,
    RcAccountData,
    TransactionData,
    WitnessData,
)


class DynamicGlobalPropertiesData(TypedDict):
    current_witness: str
    downvote_pool_percent: int
    head_block_number: int
    head_block_time: datetime
    head_block_id: str


class BlockClassifierData(TypedDict):
    transactions: list[TransactionData]
    transactions_per_id: dict[str, BlockTransaction]


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


class FeedPriceClassifierData(TypedDict):
    current_median_history: PricePair
    market_median_history: PricePair
    current_min_history: PricePair
    current_max_history: PricePair
    last_feed_price_retrieval_timestamp: datetime
    price_history: list[FeedPriceHistoryItem]
