"""Shared utilities — relative time, known exchanges, assets."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING

from .enums import Exchange

if TYPE_CHECKING:
    from hiveio_api import Asset

_RELATIVE_AMOUNT_RE = re.compile(r"[0-9]+")
_UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400}


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


def is_asset_greater_than(base: Asset, other: object) -> bool:
    """Whether ``other`` is an asset of the kind (NAI) of ``base`` with a greater amount.

    ``other`` may be given in any form of assets (e.g. the NAI form of operation bodies), anything else is not greater.

    Mirrors ``isGreaterThan`` of TS (``src/utils/assets.ts``), but compares the amounts as numbers - TS compares the
    amount strings of wax assets, so there ``"999999"`` (999.999 HIVE) is greater than ``"1000000"`` (1000.000 HIVE).
    """
    from hiveio_api import Asset  # imported here - only whale alerts compare assets

    asset = Asset.from_asset_like(other)
    return asset is not None and asset.nai == base.nai and asset.amount > base.amount
