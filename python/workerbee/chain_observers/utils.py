"""Shared utilities — datetime parsing, relative time, known exchanges."""

from __future__ import annotations

import re
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Protocol, runtime_checkable

from .enums import Exchange

_RELATIVE_AMOUNT_RE = re.compile(r"[0-9]+")
_UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400}


def parse_iso_timestamp(time_str: str) -> datetime:
    if not time_str.endswith("Z"):
        time_str += "Z"
    return datetime.fromisoformat(time_str.replace("Z", "+00:00"))


def calculate_relative_time(relative: str, reference: datetime | None = None) -> datetime:
    if reference is None:
        reference = datetime.now(UTC)

    if not relative.startswith("-"):
        raise ValueError(f"Invalid relative timestamp: {relative!r}")

    unit = relative[-1]
    if unit not in _UNIT_SECONDS:
        raise ValueError(f"Invalid relative timestamp: {relative!r}")

    amount_match = _RELATIVE_AMOUNT_RE.search(relative)
    if amount_match is None:
        raise ValueError(f"Invalid relative timestamp: {relative!r}")

    amount = int(amount_match.group(0))
    delta = timedelta(seconds=amount * _UNIT_SECONDS[unit])
    return reference - delta


def _validate_max_queue_size(max_queue_size: int) -> int:
    if max_queue_size < 0:
        raise ValueError("max_queue_size must be greater than or equal to 0")
    return max_queue_size


KNOWN_EXCHANGES: dict[str, Exchange] = {
    "bdhivesteem": Exchange.BINANCE,
    "binance-hot2": Exchange.BINANCE,
    "deepcrypto8": Exchange.BINANCE,
    "huobi-pro": Exchange.HTX,
    "huobi-withdrawal": Exchange.HTX,
    "mxchive": Exchange.MEXC,
    "probithive": Exchange.PROBIT,
    "probitred": Exchange.PROBIT,
    "user.dunamu": Exchange.UPBIT,
}


def is_exchange(account: str) -> Exchange | None:
    return KNOWN_EXCHANGES.get(account)


@runtime_checkable
class AssetLike(Protocol):
    amount: str | int
    nai: str


def _asset_parts(asset: object) -> tuple[str, str] | None:
    if isinstance(asset, Mapping):
        nai = asset.get("nai")
        amount = asset.get("amount")
    elif isinstance(asset, AssetLike):
        nai = asset.nai
        amount = asset.amount
    else:
        return None

    if not isinstance(nai, str):
        return None
    if not isinstance(amount, str | int):
        return None
    return nai, str(amount)


def is_asset_greater_than(base: object, other: object) -> bool:
    """Return True when ``other`` is greater than ``base`` for the same NAI.

    Mirrors TS WorkerBee: wax asset ``amount`` values are compared as their raw
    string values in JS, not numerically.
    """
    base_parts = _asset_parts(base)
    other_parts = _asset_parts(other)
    if base_parts is None or other_parts is None:
        return False

    base_nai, base_amount = base_parts
    other_nai, other_amount = other_parts
    return other_nai == base_nai and other_amount > base_amount
