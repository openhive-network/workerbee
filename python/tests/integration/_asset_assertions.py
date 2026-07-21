"""Asset assertion helpers shared by mirrornet integration tests."""

from __future__ import annotations

from collections.abc import Mapping

HIVE_NAI = "@@000000021"

type HiveAsset = dict[str, int | str]


def hive_threshold(coins: int) -> HiveAsset:
    """Return a HF26 HIVE asset threshold in raw precision units."""
    return {"amount": coins * 1000, "nai": HIVE_NAI, "precision": 3}


def asset_raw_amount(asset: object) -> str:
    """Return an asset amount as the raw string compared by the TS implementation."""
    if isinstance(asset, Mapping):
        amount = asset.get("amount")
        if isinstance(amount, str | int):
            return str(amount)
    if isinstance(asset, str):
        return asset.split()[0].replace(".", "")
    raise TypeError(f"Unsupported asset payload: {asset!r}")


def asset_amount_value(asset: object) -> int:
    """Return an asset amount as an integer for display-only test summaries."""
    return int(asset_raw_amount(asset))


def asset_nai(asset: object) -> str:
    """Return the asset NAI used by the WorkerBee whale-alert comparator."""
    if isinstance(asset, Mapping):
        nai = asset.get("nai")
        if isinstance(nai, str):
            return nai
    if isinstance(asset, str) and asset.endswith(" HIVE"):
        return HIVE_NAI
    raise TypeError(f"Unsupported asset payload: {asset!r}")


def ts_raw_asset_is_greater_than(base: HiveAsset, other: object) -> bool:
    """Mirror TS WorkerBee's raw string asset comparison."""
    return asset_nai(other) == base["nai"] and asset_raw_amount(other) > str(base["amount"])
