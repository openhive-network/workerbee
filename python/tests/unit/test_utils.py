"""Tests for workerbee.chain_observers.utils."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest

from workerbee.chain_observers.utils import (
    calculate_relative_time,
    is_asset_greater_than,
    is_exchange,
    parse_iso_timestamp,
)

# ---------------------------------------------------------------------------
# parse_iso_timestamp
# ---------------------------------------------------------------------------


class TestParseIsoTimestamp:
    @pytest.mark.parametrize(
        ("timestamp", "expected"),
        [
            pytest.param("2024-01-15T12:00:00", datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC), id="without-z"),
            pytest.param("2024-01-15T12:00:00Z", datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC), id="with-z"),
            pytest.param("2024-06-01T00:00:00", datetime(2024, 6, 1, 0, 0, 0, tzinfo=UTC), id="utc-aware"),
        ],
    )
    def test_parses_as_utc_aware_datetime(self, timestamp: str, expected: datetime) -> None:
        result = parse_iso_timestamp(timestamp)
        assert result == expected
        assert result.utcoffset() == timedelta(0)

    def test_round_trip_idempotent(self) -> None:
        ts_str = "2024-03-20T18:30:45"
        parsed = parse_iso_timestamp(ts_str)
        # Re-serialise and re-parse
        iso = parsed.isoformat().replace("+00:00", "Z")
        assert parse_iso_timestamp(iso) == parsed


# ---------------------------------------------------------------------------
# calculate_relative_time
# ---------------------------------------------------------------------------


class TestCalculateRelativeTime:
    _ref = datetime(2024, 6, 15, 12, 0, 0, tzinfo=UTC)

    @pytest.mark.parametrize(
        ("relative", "expected_delta"),
        [
            pytest.param("-7d", timedelta(days=7), id="days"),
            pytest.param("-3h", timedelta(hours=3), id="hours"),
            pytest.param("-30m", timedelta(minutes=30), id="minutes"),
            pytest.param("-10s", timedelta(seconds=10), id="seconds"),
        ],
    )
    def test_offsets_reference_time(self, relative: str, expected_delta: timedelta) -> None:
        result = calculate_relative_time(relative, self._ref)
        assert result == self._ref - expected_delta

    def test_fractional_amount_uses_integer_component_like_typescript(self) -> None:
        result = calculate_relative_time("-1.5h", self._ref)
        assert result == self._ref - timedelta(hours=1)

    @pytest.mark.parametrize(
        ("relative", "expected_delta"),
        [
            pytest.param("-.5h", timedelta(hours=5), id="digits-after-decimal-point"),
            pytest.param("-1.h", timedelta(hours=1), id="trailing-decimal-point"),
            pytest.param("-1hm", timedelta(minutes=1), id="unit-comes-from-last-character"),
            pytest.param("--1h", timedelta(hours=1), id="first-digit-run-after-extra-minus"),
            pytest.param("-abc1h", timedelta(hours=1), id="first-digit-run-after-text"),
        ],
    )
    def test_loose_relative_time_parsing_matches_typescript(self, relative: str, expected_delta: timedelta) -> None:
        result = calculate_relative_time(relative, self._ref)
        assert result == self._ref - expected_delta

    def test_invalid_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid relative timestamp"):
            calculate_relative_time("7d")

    @pytest.mark.parametrize(
        "relative",
        [
            pytest.param("-" + chr(0x0661) + "h", id="arabic-indic"),
            pytest.param("-" + chr(0xFF11) + chr(0xFF12) + "h", id="fullwidth"),
        ],
    )
    def test_unicode_digits_are_invalid_like_typescript(self, relative: str) -> None:
        with pytest.raises(ValueError, match="Invalid relative timestamp"):
            calculate_relative_time(relative, self._ref)

    def test_default_reference_is_utc_now(self) -> None:
        before = datetime.now(UTC)
        result = calculate_relative_time("-0s")
        after = datetime.now(UTC)
        assert before <= result <= after


# ---------------------------------------------------------------------------
# is_exchange
# ---------------------------------------------------------------------------


class TestIsExchange:
    def test_unknown_returns_none(self) -> None:
        assert is_exchange("random") is None


class TestIsAssetGreaterThan:
    def test_dict_assets_compare_numeric_amounts_for_same_nai(self) -> None:
        base = {"amount": "1000", "nai": "@@000000021", "precision": 3}
        other = {"amount": "2000", "nai": "@@000000021", "precision": 3}
        assert is_asset_greater_than(base, other) is True

    def test_object_assets_compare_numeric_amounts_for_same_nai(self) -> None:
        base = SimpleNamespace(amount="1000", nai="@@000000021")
        other = SimpleNamespace(amount="2000", nai="@@000000021")
        assert is_asset_greater_than(base, other) is True

    def test_rejects_different_nai(self) -> None:
        base = {"amount": "1000", "nai": "@@000000021", "precision": 3}
        other = {"amount": "2000", "nai": "@@000000013", "precision": 3}
        assert is_asset_greater_than(base, other) is False

    def test_rejects_missing_amount(self) -> None:
        base = {"amount": "1000", "nai": "@@000000021", "precision": 3}
        other = {"nai": "@@000000021", "precision": 3}
        assert is_asset_greater_than(base, other) is False
