"""Tests for workerbee.chain_observers.utils."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from hiveio_api import Asset

from workerbee.chain_observers.utils import (
    calculate_relative_time,
    is_asset_greater_than,
    is_exchange,
)

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
    @pytest.mark.parametrize(
        ("base", "other", "expected"),
        [
            pytest.param(Asset.hive.tokens(1000), Asset.hive.tokens("1000.001"), True, id="greater"),
            pytest.param(Asset.hive.tokens(1000), Asset.hive.tokens(1000), False, id="equal"),
            # amounts of different lengths - TS compares their strings: "999999" > "1000000"
            pytest.param(Asset.hive.tokens(1000), Asset.hive.tokens("999.999"), False, id="smaller-shorter-amount"),
            pytest.param(Asset.hive.tokens(900), Asset.hive.tokens(1000), True, id="greater-longer-amount"),
            pytest.param(Asset.hive.tokens(1000), Asset.hbd.tokens(2000), False, id="different-nai"),
        ],
    )
    def test_compares_amounts_of_the_same_nai_as_numbers(self, base: Asset, other: Asset, expected: bool) -> None:
        assert is_asset_greater_than(base, other) is expected
