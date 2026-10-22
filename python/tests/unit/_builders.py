"""Builders for real hiveio_api chain models used as test fixtures.

WorkerBee never hand-rolls chain-data shapes (CLAUDE.md): test fakes must be
real ``hiveio_api`` models (dataclasses), not ``SimpleNamespace`` stand-ins.
``Account`` alone has 61 required fields, so rather than spell every field out we
fill required fields from the model definition with type-appropriate zero values
(models are not validated, so loose zeros are fine) and let callers override the
few that matter via keyword arguments.

Eager hiveio_api imports here are intentional - tests are exempt from the
``import workerbee`` time budget (see ``tests/unit/test_import_time.py``).
"""

from __future__ import annotations

import dataclasses
import types
import typing
from typing import Any, get_args, get_origin

from hiveio_api import Asset, HiveDateTime
from hiveio_api.block_api import Block, GetBlockRangeResponse, GetBlockResponse
from hiveio_api.database_api import (
    Account,
    CashoutInfo,
    CommentPendingPayoutType,
    FindAccountsResponse,
    FindWitnessesResponse,
    GetCommentPendingPayoutsResponse,
    GetFeedHistoryResponse,
    Witness,
)
from hiveio_api.operations import Price
from hiveio_api.rc_api import FindRcAccountsResponse, RcAccount


def _zero(annotation: Any, declared: str) -> Any:
    """Return a benign zero value for a model field annotation.

    Recurses into nested models, unwraps unions (skipping ``None``), and empties
    containers. ``declared`` is the annotation as written in the model (e.g.
    ``AssetHbd``) - it tells the kind of zero assets.
    """
    origin = get_origin(annotation)

    if origin is types.UnionType or origin is typing.Union:
        for arg in get_args(annotation):
            if arg is not type(None):
                return _zero(arg, declared)
        return None

    if origin in (list, set, frozenset, tuple):
        return []
    if origin is dict:
        return {}

    if annotation is Asset:
        kind = Asset.hbd if "Hbd" in declared else Asset.vests if "Vests" in declared else Asset.hive
        return kind.satoshi(0)
    if annotation is HiveDateTime:
        return HiveDateTime.fromtimestamp(0)
    if isinstance(annotation, type):
        if dataclasses.is_dataclass(annotation):
            return _build(annotation)
        if issubclass(annotation, bool):
            return False
        if issubclass(annotation, int):
            return 0
        if issubclass(annotation, float):
            return 0.0
        if issubclass(annotation, str):
            return ""

    return None


def _build(cls: type[Any], **overrides: Any) -> Any:
    """Construct ``cls`` with all required fields defaulted; apply ``overrides``."""
    hints = typing.get_type_hints(cls)
    kwargs: dict[str, Any] = dict(overrides)
    for field in dataclasses.fields(cls):
        if field.name in kwargs:
            continue
        if field.default is not dataclasses.MISSING or field.default_factory is not dataclasses.MISSING:
            continue
        kwargs[field.name] = _zero(hints[field.name], str(field.type))
    return cls(**kwargs)


def build_account(name: str = "alice", **overrides: Any) -> Account:
    """A real ``database_api.Account`` with sensible JSON-metadata defaults."""
    overrides.setdefault("json_metadata", "{}")
    overrides.setdefault("posting_json_metadata", "{}")
    return _build(Account, name=name, **overrides)


def build_witness(owner: str = "witness-a", **overrides: Any) -> Witness:
    """A real ``database_api.Witness``."""
    return _build(Witness, owner=owner, **overrides)


def build_rc_account(account: str = "alice", **overrides: Any) -> RcAccount:
    """A real ``rc_api.RcAccount``."""
    return _build(RcAccount, account=account, **overrides)


def find_accounts_response(*accounts: Account) -> FindAccountsResponse:
    """Wrap accounts in a real ``find_accounts`` response."""
    return _build(FindAccountsResponse, accounts=list(accounts))


def find_witnesses_response(*witnesses: Witness) -> FindWitnessesResponse:
    """Wrap witnesses in a real ``find_witnesses`` response."""
    return _build(FindWitnessesResponse, witnesses=list(witnesses))


def find_rc_accounts_response(*rc_accounts: RcAccount) -> FindRcAccountsResponse:
    """Wrap RC accounts in a real ``find_rc_accounts`` response."""
    return _build(FindRcAccountsResponse, rc_accounts=list(rc_accounts))


def build_cashout_info(**overrides: Any) -> CashoutInfo:
    """A real ``database_api.CashoutInfo`` (of a comment before its payout)."""
    return _build(CashoutInfo, **overrides)


def build_comment_pending_payout(author: str, permlink: str, cashout_info: CashoutInfo | None) -> CommentPendingPayoutType:
    """A real ``database_api.CommentPendingPayoutType`` - ``cashout_info`` is None for paid comments."""
    return _build(CommentPendingPayoutType, author=author, permlink=permlink, cashout_info=cashout_info)


def get_comment_pending_payouts_response(*cashout_infos: CommentPendingPayoutType) -> GetCommentPendingPayoutsResponse:
    """Wrap pending payouts in a real ``get_comment_pending_payouts`` response."""
    return _build(GetCommentPendingPayoutsResponse, cashout_infos=list(cashout_infos))


def build_block(**overrides: Any) -> Block:
    """A real ``block_api.Block`` (without transactions by default)."""
    return _build(Block, **overrides)


def get_block_response(block: Block | None) -> GetBlockResponse:
    """Wrap a block in a real ``get_block`` response - ``None`` of a block not produced yet."""
    return _build(GetBlockResponse, block=block)


def get_block_range_response(*blocks: Block) -> GetBlockRangeResponse:
    """Wrap blocks in a real ``get_block_range`` response."""
    return _build(GetBlockRangeResponse, blocks=list(blocks))


def build_price(base_hbd_satoshi: int, quote_hive_satoshi: int) -> Price:
    """A real feed ``Price`` - ``base`` HBD per ``quote`` HIVE."""
    return Price(base=Asset.hbd.satoshi(base_hbd_satoshi), quote=Asset.hive.satoshi(quote_hive_satoshi))


def get_feed_history_response(*price_history: Price) -> GetFeedHistoryResponse:
    """A real ``get_feed_history`` response - the first price of the history is the current median and the extremes."""
    current = price_history[0] if price_history else build_price(0, 0)
    return _build(
        GetFeedHistoryResponse,
        price_history=list(price_history),
        current_median_history=current,
        market_median_history=current,
        current_min_history=current,
        current_max_history=current,
    )
