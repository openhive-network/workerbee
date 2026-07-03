"""Typed event-payload shapes delivered to subscribers.

WorkerBee-side container types (per-account groupings, the operation/transaction
pair) are declared here as ``PayloadBase``s. Their leaf chain entities reference
``hiveio_api`` models (the canonical Hive model package) rather than raw dicts.

hiveio_api models are imported under ``TYPE_CHECKING`` only: the data already
arrives typed from the API at runtime, so annotating with these models adds zero
import-time cost (the ``*_description`` modules are large - see
``tests/unit/test_import_time.py``).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypedDict, TypeGuard

if TYPE_CHECKING:
    from datetime import datetime

    from hiveio_api.block_api import Operation, Transaction3, Transaction4
    from hiveio_api.database_api import (
        Balance,
        CuratorPayoutValue,
        CurrentMaxHistory3,
        CurrentMedianHistory3,
        CurrentMinHistory3,
        DelegatedVestingShares,
        HbdBalance,
        PriceHistoryItem3,
        ReceivedVestingShares,
        RewardHbdBalance,
        RewardHiveBalance,
        RewardVestingBalance,
        SavingsBalance,
        SavingsHbdBalance,
        TotalPayoutValue,
        VestingShares,
        VestingWithdrawRate,
    )

    from .enums import AlarmType, Exchange, ManabarType


class PayloadBase(TypedDict):
    """Base for every typed payload shape.

    A pure marker: a ``TypedDict`` subclass cannot carry methods (PEP 589 -- its
    runtime type is always a plain ``dict``, so a method defined here is silently
    dropped and a method call raises ``AttributeError``). Payload validation
    therefore lives in the module-level :func:`has_payload` ``TypeGuard`` below.
    """


def has_payload[PayloadT: PayloadBase](note: object, payload_cls: type[PayloadT]) -> TypeGuard[PayloadT]:
    """Whether ``note`` carries every declared key of ``payload_cls``, present and non-None.

    A ``TypeGuard`` so a caller can narrow a loosely-typed notification to one
    payload and then index its key with full typing -- the typed replacement for
    ``isinstance(note.get("..."), dict)``::

        if not has_payload(note, ImpactedAccountsPayload):
            continue
        impacted = note["impacted_accounts"]   # dict[str, list[OperationTransactionPair]]

    ``note`` is the FIRST parameter because ``TypeGuard`` narrows a function's
    first argument; ``payload_cls`` selects which payload to test.

    Totality: this requires EVERY declared key (``__annotations__``) present and
    non-None -- it deliberately does NOT follow TypedDict ``total``. The
    notification fragments (the ``*Payload`` types) are single-key ``total=False``
    shapes, so an empty ``{}`` is a *structurally valid* fragment; a totality-aware
    check (only ``__required_keys__``, which is empty for them) would accept ``{}``
    and make the subsequent ``note["..."]`` an unsafe missing-key access. We want
    the key actually present so it can be read -- hence "all declared keys". Intended
    for the single-key ``*Payload`` fragments, not multi-key leaf shapes (where
    "all keys present" would over-require, e.g. a discriminated-union op body).
    """
    if not isinstance(note, dict):
        return False
    return all(note.get(key) is not None for key in payload_cls.__annotations__)


class TransactionData(PayloadBase):
    """A block transaction paired with its id (mirrors TS ITransactionData).

    The transaction is a ``Transaction4`` on the live ``get_block`` path
    (``Block1``) and a structurally identical ``Transaction3`` on the
    ``get_block_range`` catch-up path — hence the union leaf.
    """

    transaction: Transaction3 | Transaction4
    id: str


class OperationTransactionPair(PayloadBase):
    """An operation together with the transaction that carried it.

    Mirrors TS ``IOperationTransactionPair``. ``operation`` is the hiveio_api
    block operation envelope — ``operation.type`` (str) and ``operation.value``
    (the operation body as ``dict[str, Any]``, the shape block_api exposes).
    """

    operation: Operation
    transaction: TransactionData


class ImpactedAccountsPayload(PayloadBase, total=False):
    """Payload from ``on_impacted_accounts(...)``: operations per tracked account."""

    impacted_accounts: dict[str, list[OperationTransactionPair]]


# ---------------------------------------------------------------------------
# Account family (AccountProvider / RcAccountProvider / WitnessProvider /
# ManabarProvider). Mirrors TS IAccount/IRcAccount/IWitness/IManabarDataPercent
# (src/chain-observers/classifiers/{account,rc-account,witness,manabar}-classifier.ts),
# snake_cased and shaped to what the Python collectors actually emit.
#
# Balance leaves keep their distinct hiveio_api per-field asset structs (each is
# ``{amount: str | int, nai: str, precision: int}``); TS collapses them to a
# single wax ``asset``, but the Python collectors pass the source structs through
# untouched (by direct attribute access), so the precise field class is the honest
# runtime type. Every one of these account fields is required, so no leaf is optional.
#
# ---------------------------------------------------------------------------


class HbdDetailedBalance(PayloadBase):
    """HBD sub-balance: liquid/savings/unclaimed plus TS-compatible total."""

    liquid: HbdBalance
    savings: SavingsHbdBalance
    unclaimed: RewardHbdBalance
    total: HbdBalance


class HiveDetailedBalance(PayloadBase):
    """HIVE sub-balance (same shape as HBD with HIVE-side asset structs)."""

    liquid: Balance
    savings: SavingsBalance
    unclaimed: RewardHiveBalance
    total: Balance


class HpDetailedBalance(PayloadBase):
    """HP (vesting) sub-balance — adds delegated/received/powering_down."""

    liquid: VestingShares
    delegated: DelegatedVestingShares
    received: ReceivedVestingShares
    powering_down: VestingWithdrawRate
    unclaimed: RewardVestingBalance
    total: VestingShares


class AccountBalance(PayloadBase):
    """The three balance buckets of an account (mirrors TS IAccountBalance)."""

    HBD: HbdDetailedBalance
    HIVE: HiveDetailedBalance
    HP: HpDetailedBalance


class AccountData(PayloadBase):
    """A single tracked account, reshaped by AccountCollector (TS IAccount).

    ``json_metadata``/``posting_json_metadata`` are parsed like TS
    ``tryParseJson(...)`` and fall back to ``{}`` for invalid JSON.
    """

    name: str
    balance: AccountBalance
    upvote_manabar: UpvoteManabarData
    downvote_manabar: DownvoteManabarData
    json_metadata: dict[str, Any]
    posting_json_metadata: dict[str, Any]
    recovery_account: str
    governance_vote_expiration: datetime | None


class AccountsPayload(PayloadBase, total=False):
    """Payload from ``provide_accounts(...)``: account data per tracked name.

    Missing chain accounts are retained under the requested key with ``None``
    (mirrors TS ``undefined`` values in the partial result object).
    """

    accounts: dict[str, AccountData | None]


class RcAccountData(PayloadBase):
    """A single RC account, reshaped by RcAccountCollector (TS IRcAccount)."""

    name: str
    rc_manabar: RcManabarData


class RcAccountsPayload(PayloadBase, total=False):
    """Payload from ``provide_rc_accounts(...)``: RC data per tracked name.

    Missing chain RC accounts are retained under the requested key with
    ``None`` (mirrors TS ``undefined``).
    """

    rc_accounts: dict[str, RcAccountData | None]


class UpvoteManabarData(PayloadBase):
    """Upvote manabar reshaped by AccountCollector (TS IManabarData).

    ``max`` is synthesised from the account's ``post_voting_power`` (the raw
    voting_manabar struct carries no max).
    """

    current_mana: str | int
    max: str | int
    last_update_time: int


class DownvoteManabarData(PayloadBase):
    """Downvote manabar reshaped by AccountCollector (no ``max`` source, per TS)."""

    current_mana: str | int
    last_update_time: int


class RcManabarData(PayloadBase):
    """RC manabar reshaped by RcAccountCollector, with ``max_rc`` folded in."""

    current_mana: str | int
    max_rc: str | int
    last_update_time: int


class ManabarValue(PayloadBase):
    """A computed manabar reading (TS IManabarDataPercent).

    Synthesised by ManabarCollector via ``calculate_current_manabar_value`` —
    not a chain struct, hence a WorkerBee PayloadBase.
    """

    current_mana: int
    max: int
    percent: float
    last_update_time: datetime


class ManabarPayload(PayloadBase, total=False):
    """Payload from ``on_accounts_full_manabar(...)`` / manabar tracking.

    ``manabar_data[account][manabar_type]`` — inner key is a ``ManabarType``.
    """

    manabar_data: dict[str, dict[ManabarType, ManabarValue]]


class WitnessData(PayloadBase):
    """A single witness, reshaped by WitnessCollector (TS IWitness)."""

    owner: str
    running_version: str
    total_missed_blocks: int
    last_confirmed_block_num: int | str


class WitnessesPayload(PayloadBase, total=False):
    """Payload from ``provide_witnesses(...)``: witness data per tracked owner.

    Missing witnesses are retained under the requested key with ``None``
    (mirrors TS ``undefined``).
    """

    witnesses: dict[str, WitnessData | None]


# ---------------------------------------------------------------------------
# Social operations (Vote/Post/Comment/CustomOperation/Mention/Follow/Reblog).
# Mirrors TS vote/blog-content/custom-operation/mention/follow/reblog providers.
#
# These read from ``operations_per_type[<type>]`` entries, which the
# OperationCollector shapes as ``{operation: op.value-body, transaction}`` — the
# operation here is the *unwrapped op body*, a raw undecoded JSON object, hence
# ``OpBodyTransactionPair`` (distinct from the Operation-envelope
# ``OperationTransactionPair``). block_api does not decode op bodies into typed
# structs, so ``dict[str, object]`` is the honest leaf — a precise per-op PayloadBase
# would be a hand-rolled chain-data model (disallowed). TS annotates these with the
# wax ``vote``/``comment``/``custom_json`` operation types; the Python runtime keeps
# the raw dict.
#
# Follow/Reblog are the exception: WorkerBee *computes* a projection from the
# parsed custom_json, so FollowOperation/ReblogOperation are WorkerBee PayloadBases
# (mirror TS IFollowOperation/IReblogOperation). TS types follow ``what`` as
# ``EFollowActions``, but the Python provider stores the raw parsed value — a list
# of action strings — so ``what`` is ``list[str]``.
# ---------------------------------------------------------------------------


class OpBodyTransactionPair(PayloadBase):
    """An unwrapped op body (raw ``op.value``) paired with its transaction."""

    operation: dict[str, object]
    transaction: TransactionData


type OperationsPerType = dict[str, list[OpBodyTransactionPair]]
type OperationBodiesByAccount = dict[str, list[dict[str, object]]]


class VotesPayload(PayloadBase, total=False):
    """Payload from ``on_votes(...)``: vote-op pairs per tracked voter."""

    votes: dict[str, list[OpBodyTransactionPair]]


class PostsPayload(PayloadBase, total=False):
    """Payload from ``on_posts(...)``: top-level comment-op pairs per author."""

    posts: dict[str, list[OpBodyTransactionPair]]


class CommentsPayload(PayloadBase, total=False):
    """Payload from ``on_comments(...)``: reply comment-op pairs per author."""

    comments: dict[str, list[OpBodyTransactionPair]]


class CustomOperationsPayload(PayloadBase, total=False):
    """Payload from ``on_custom_operation(...)``: custom_json-op pairs per id."""

    custom_operations: dict[str, list[OpBodyTransactionPair]]


class MentionsPayload(PayloadBase, total=False):
    """Payload from ``on_mention(...)``: the bare comment op bodies, per account.

    Unlike the other social payloads, mentions store the op body alone (no
    transaction wrapper) — mirrors TS ``WorkerBeeIterable<comment>``.
    """

    mentioned: OperationBodiesByAccount


class FollowOperation(PayloadBase):
    """WorkerBee projection of a parsed ``follow`` custom_json (TS IFollowOperation)."""

    follower: str
    following: str
    what: list[str]


class FollowOperationPair(PayloadBase):
    """A follow projection paired with its transaction."""

    operation: FollowOperation
    transaction: TransactionData


class FollowsPayload(PayloadBase, total=False):
    """Payload from ``on_follow(...)``: follow projections per follower."""

    follows: dict[str, list[FollowOperationPair]]


class ReblogOperation(PayloadBase):
    """WorkerBee projection of a parsed ``reblog`` custom_json (TS IReblogOperation)."""

    account: str
    author: str
    permlink: str


class ReblogOperationPair(PayloadBase):
    """A reblog projection paired with its transaction."""

    operation: ReblogOperation
    transaction: TransactionData


class ReblogsPayload(PayloadBase, total=False):
    """Payload from ``on_reblog(...)``: reblog projections per account."""

    reblogs: dict[str, list[ReblogOperationPair]]


# ---------------------------------------------------------------------------
# Block / transaction (BlockHeader/Block/TransactionById providers). Mirrors TS
# IBlockHeaderData / IBlockData / ITransactionData. These were previously declared
# loosely in bot.py; they live here now so the leaf transactions reference the
# real hiveio_api Transaction structs.
# ---------------------------------------------------------------------------


class BlockHeaderData(PayloadBase):
    """Block header fields (mirrors TS IBlockHeaderData).

    ``timestamp`` is the head-block time as a ``datetime`` — the DGP collector
    parses it via ``parse_iso_timestamp`` and the header collector passes it
    through (the old bot.py contract mistyped it as ``str``).
    """

    number: int
    id: str
    timestamp: datetime
    witness: str


class BlockData(BlockHeaderData):
    """A full block: header fields plus its transactions (mirrors TS IBlockData)."""

    transactions: list[TransactionData]
    transactions_per_id: dict[str, Transaction3 | Transaction4]


class BlockHeaderPayload(PayloadBase, total=False):
    """Payload from ``on_block`` header-only providers: just the block header."""

    block: BlockHeaderData


class BlockPayload(PayloadBase, total=False):
    """Payload from ``provide_block_data()``: the full block."""

    block: BlockData


class TransactionsByIdPayload(PayloadBase, total=False):
    """Payload from ``provide_transactions(...)``: tracked transactions per id."""

    transactions: dict[str, Transaction3 | Transaction4]


# ---------------------------------------------------------------------------
# Content metadata (Post/CommentMetadataProvider) and feed price (FeedPrice
# provider). Mirrors TS content-metadata / feed-price providers.
#
# ContentMetadata is a WorkerBee-computed reshape of a comment's pending-payout
# cashout info (TS TContentMetadataAuthorData entries); the asset leaves keep the
# hiveio_api cashout asset structs and are ``| None`` on the already-paid path.
# ---------------------------------------------------------------------------


class ContentMetadata(PayloadBase):
    """Reshaped per-permlink content metadata (one post or comment)."""

    author: str
    permlink: str
    parent_author: str
    parent_permlink: str
    category: str
    title: str
    allows_curation_rewards: bool
    allows_replies: bool
    allows_votes: bool
    author_rewards: int
    curator_payout_value: CuratorPayoutValue | None
    net_rshares: int
    net_votes: int
    payout_time: str | None
    is_paid: bool
    total_payout_value: TotalPayoutValue | None


class PostsMetadataPayload(PayloadBase, total=False):
    """Payload from ``on_posts_metadata(...)``: post metadata per author/permlink."""

    posts_metadata: dict[str, dict[str, ContentMetadata]]


class CommentsMetadataPayload(PayloadBase, total=False):
    """Payload from ``on_comments_metadata(...)``: comment metadata per author/permlink."""

    comments_metadata: dict[str, dict[str, ContentMetadata]]


class FeedPriceData(PayloadBase):
    """The ``feed_price`` payload value — the subset the provider exposes.

    The provider drops the collector's ``market_median_history`` and
    ``last_feed_price_retrieval_timestamp``; each history leaf is a hiveio_api
    price struct with ``base``/``quote``.
    """

    current_median_history: CurrentMedianHistory3
    current_min_history: CurrentMinHistory3
    current_max_history: CurrentMaxHistory3
    price_history: list[PriceHistoryItem3]


class FeedPricePayload(PayloadBase, total=False):
    """Payload from ``on_feed_price_change(...)`` / feed tracking."""

    feed_price: FeedPriceData


# ---------------------------------------------------------------------------
# new_account / alarm / market ops (NewAccount/Alarm/ExchangeTransfer/WhaleAlert/
# InternalMarket providers). Mirrors the corresponding TS providers.
#
# These op bodies are WorkerBee projections built from raw op.value, so they are
# WorkerBee PayloadBases. The authority leaves (owner/active/posting) and transfer
# ``amount`` stay raw (undecoded op.value, ``dict``/``object``) — no clean
# hiveio_api leaf. The exchange/whale metadata carry a ``from`` key (a Python
# keyword), so they use functional PayloadBase syntax.
# ---------------------------------------------------------------------------


class NewAccountData(PayloadBase):
    """A newly created account (mirrors TS TNewAccountProvided).

    ``owner``/``active``/``posting`` are the raw authority objects from the
    creation op (undecoded ``op.value``); ``None`` when the op omits them.
    """

    account_name: str
    active: dict[str, object] | None
    creator: str
    json_metadata: dict[str, object]
    memo: str
    owner: dict[str, object] | None
    posting: dict[str, object] | None


class NewAccountsPayload(PayloadBase, total=False):
    """Payload from ``on_new_account(...)``: the new accounts in the block."""

    new_accounts: list[NewAccountData]


class AlarmsPayload(PayloadBase, total=False):
    """Payload from ``on_alarm(...)``: alarm types per tracked account."""

    alarms_per_account: dict[str, list[AlarmType]]


# ``from`` is a Python keyword → functional PayloadBase syntax. ``amount`` is the
# raw op.value amount (a NaiAsset dict on hf26, or a legacy string), hence ``object``.
ExchangeTransferMetadata = TypedDict(
    "ExchangeTransferMetadata",
    {"from": str, "to": str, "amount": object, "exchange": "Exchange"},
)


class ExchangeTransferPair(PayloadBase):
    """An exchange-transfer projection paired with its transaction."""

    operation: ExchangeTransferMetadata
    transaction: TransactionData


class ExchangeTransferPayload(PayloadBase, total=False):
    """Payload from ``on_exchange_transfer(...)``: transfers touching exchanges."""

    exchange_transfer_operations: list[ExchangeTransferPair]


WhaleAlertMetadata = TypedDict(
    "WhaleAlertMetadata",
    {"from": str, "to": str, "amount": object},
)


class WhaleAlertPair(PayloadBase):
    """A whale-transfer projection paired with its transaction."""

    operation: WhaleAlertMetadata
    transaction: TransactionData


class WhaleAlertPayload(PayloadBase, total=False):
    """Payload from ``on_whale_alert(...)``: transfers above a threshold."""

    whale_operations: list[WhaleAlertPair]


class InternalMarketOperation(PayloadBase, total=False):
    """A limit-order op projection (mirrors TS TInternalMarketOperation).

    ``cancel`` discriminates: ``True`` → only owner/order_id are set; ``False`` →
    the create fields (amount_to_sell/filled/exchange_rate/expiration) are present.
    ``total=False`` models the discriminated union.
    """

    cancel: bool
    owner: str
    order_id: int
    amount_to_sell: object
    filled: bool
    exchange_rate: dict[str, object]
    expiration: datetime


class InternalMarketPair(PayloadBase):
    """An internal-market projection paired with its transaction."""

    operation: InternalMarketOperation
    transaction: TransactionData


class InternalMarketPayload(PayloadBase, total=False):
    """Payload from ``on_internal_market(...)``: limit-order operations."""

    internal_market_operations: list[InternalMarketPair]


# ---------------------------------------------------------------------------
# The aggregate notification delivered to a subscriber's ``next`` callback.
# ---------------------------------------------------------------------------


class ObserverNotification(
    ImpactedAccountsPayload,
    AccountsPayload,
    RcAccountsPayload,
    ManabarPayload,
    WitnessesPayload,
    VotesPayload,
    PostsPayload,
    CommentsPayload,
    CustomOperationsPayload,
    MentionsPayload,
    FollowsPayload,
    ReblogsPayload,
    BlockPayload,
    TransactionsByIdPayload,
    PostsMetadataPayload,
    CommentsMetadataPayload,
    FeedPricePayload,
    NewAccountsPayload,
    AlarmsPayload,
    ExchangeTransferPayload,
    WhaleAlertPayload,
    InternalMarketPayload,
    total=False,
):
    """The merged payload delivered to an observer's ``next`` callback.

    The mediator flat-merges every matched provider's payload into one dict, so a
    single notification may carry several of these keys at once. Every key is
    optional (``total=False``) — which are present depends on the providers the
    subscription registered. The ``block`` value is the full :class:`BlockData`
    (header-only ``on_block`` filters populate just its header subset).
    """
