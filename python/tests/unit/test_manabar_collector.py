"""Tests for ManabarCollector — real calculation via chain.calculate_current_manabar_value.

Covers: upvote, downvote, RC manabar types; zero max_mana edge case;
missing account graceful handling; push_options/pop_options reference counting;
result shape validation; downvote pool percent calculation.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.dynamic_global_properties_classifier import (
    DynamicGlobalPropertiesClassifier,
)
from workerbee.chain_observers.classifiers.manabar_classifier import ManabarClassifier
from workerbee.chain_observers.classifiers.rc_account_classifier import RcAccountClassifier
from workerbee.chain_observers.collectors.common.manabar_collector import (
    ONE_HUNDRED_PERCENT,
    ManabarCollector,
)
from workerbee.chain_observers.enums import ManabarType

# ---------------------------------------------------------------------------
# Fakes — no monkeypatch, constructor injection
# ---------------------------------------------------------------------------


class FakeManabarResult:
    """Mimics wax ManabarData returned by calculate_current_manabar_value."""

    def __init__(self, max_mana: int, current_mana: int, percent: float) -> None:
        self.max_mana = max_mana
        self.current_mana = current_mana
        self.percent = Decimal(str(percent))


class FakeChainForManabar:
    """Chain fake that provides calculate_current_manabar_value."""

    def __init__(self, regen_fraction: float = 0.0) -> None:
        self._regen_fraction = regen_fraction
        self.calc_calls: list[tuple[datetime, int, int, int]] = []

    def calculate_current_manabar_value(
        self,
        head_block_time: datetime,
        max_mana: int,
        current_mana: int,
        last_update_time: int,
    ) -> FakeManabarResult:
        self.calc_calls.append((head_block_time, max_mana, current_mana, last_update_time))
        if max_mana == 0:
            return FakeManabarResult(0, 0, 0.0)
        regenerated = int(max_mana * self._regen_fraction)
        actual_current = min(current_mana + regenerated, max_mana)
        percent = round((actual_current / max_mana) * 100, 2)
        return FakeManabarResult(max_mana, actual_current, percent)


class FakeDataEvaluationContext:
    """Mimics TCollectorEvaluationContext for collector.get() calls."""

    def __init__(self, data_map: dict[type, dict[str, object]]) -> None:
        self._data = data_map
        self.timings: list[tuple[str, float]] = []

    async def get(self, classifier_class: type) -> dict[str, object]:
        result = self._data.get(classifier_class, {})
        return result

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        try:
            yield
        finally:
            self.timings.append((name, 0.0))


HEAD_TIME = datetime(2024, 6, 15, 12, 0, 0)
SOURCE_LAST_UPDATE = 1_700_000_000
SOURCE_LAST_UPDATE_TIME = datetime.fromtimestamp(SOURCE_LAST_UPDATE, UTC).replace(tzinfo=None)


def dynamic_global_properties_data(downvote_pool_percent: int = 25) -> dict[str, object]:
    return {
        "head_block_time": HEAD_TIME,
        "head_block_number": 100,
        "downvote_pool_percent": downvote_pool_percent,
    }


def account_manabar_data(
    name: str,
    upvote_current: int = 5000,
    upvote_max: int = 10000,
    upvote_last_update: int = 0,
    downvote_current: int = 500,
    downvote_last_update: int = 0,
) -> dict[str, object]:
    return {
        "name": name,
        "upvote_manabar": {
            "current_mana": upvote_current,
            "max_mana": upvote_max,
            "last_update_time": upvote_last_update,
        },
        "downvote_manabar": {
            "current_mana": downvote_current,
            "last_update_time": downvote_last_update,
        },
    }


def rc_account_manabar_data(name: str, current: int = 8000, max_rc: int = 10000, last_update: int = 0) -> dict[str, object]:
    return {
        "name": name,
        "rc_manabar": {
            "current_mana": current,
            "max_rc": max_rc,
            "last_update_time": last_update,
        },
    }


# ---------------------------------------------------------------------------
# Setup helpers — build collector + run get() without per-test boilerplate
# ---------------------------------------------------------------------------


def collector_with_chain(regen_fraction: float = 0.0) -> ManabarCollector:
    """Build a ManabarCollector wired to a fresh fake chain."""
    chain = FakeChainForManabar(regen_fraction=regen_fraction)
    worker = SimpleNamespace(chain=chain)
    return ManabarCollector(worker)


def manabar_context(
    *,
    dgp: dict[str, object] | None = None,
    accounts: dict[str, dict[str, object]] | None = None,
    rc_accounts: dict[str, dict[str, object]] | None = None,
) -> FakeDataEvaluationContext:
    """Build the collector context used by manabar calculations."""
    data: dict[type, dict[str, object]] = {
        DynamicGlobalPropertiesClassifier: dgp or dynamic_global_properties_data(),
    }
    if accounts is not None:
        data[AccountClassifier] = {"accounts": accounts}
    if rc_accounts is not None:
        data[RcAccountClassifier] = {"rc_accounts": rc_accounts}
    return FakeDataEvaluationContext(data)


def _manabar_data(result: dict[str, object]) -> dict[str, object]:
    """Extract the manabar_data sub-dict from a collector get() result."""
    return result[ManabarClassifier.__name__]["manabar_data"]


def _manabar_entry(result: dict[str, object], account: str, manabar_type: ManabarType) -> dict[str, object]:
    """Extract the deeply-nested per-account/per-type manabar entry."""
    return _manabar_data(result)[account][manabar_type]


async def _collect_entry(
    *,
    account: str,
    manabar_type: ManabarType,
    ctx: FakeDataEvaluationContext,
    regen_fraction: float = 0.0,
) -> dict[str, object]:
    collector = collector_with_chain(regen_fraction=regen_fraction)
    collector.push_options({"account": account, "manabar_type": manabar_type})
    result = await collector.get(ctx)
    return _manabar_entry(result, account, manabar_type)


# ---------------------------------------------------------------------------
# Tests: push_options / pop_options reference counting
# ---------------------------------------------------------------------------


class TestManabarCollectorOptions:
    def test_push_options_adds_to_upvote(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        assert "alice" in collector._upvote_accounts
        assert collector._upvote_accounts["alice"] == 1

    def test_push_options_increments_count(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})
        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        assert collector._upvote_accounts["alice"] == 2

    def test_push_options_downvote(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "bob", "manabar_type": ManabarType.DOWNVOTE})

        assert "bob" in collector._downvote_accounts

    def test_push_options_rc(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "carol", "manabar_type": ManabarType.RC})

        assert "carol" in collector._rc_accounts

    def test_pop_options_decrements(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})
        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})
        collector.pop_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        assert collector._upvote_accounts["alice"] == 1

    def test_pop_options_removes_on_zero(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})
        collector.pop_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        assert "alice" not in collector._upvote_accounts

    def test_push_options_empty_account_raises(self) -> None:
        collector = collector_with_chain()

        with pytest.raises(ValueError, match="account must not be empty"):
            collector.push_options({"account": "", "manabar_type": ManabarType.UPVOTE})

    def test_push_options_invalid_type_raises(self) -> None:
        collector = collector_with_chain()

        with pytest.raises(ValueError, match="Unsupported manabar type"):
            collector.push_options({"account": "alice", "manabar_type": 99})


# ---------------------------------------------------------------------------
# Tests: used_contexts
# ---------------------------------------------------------------------------


class TestManabarCollectorUsedContexts:
    def test_empty_returns_only_dgp(self) -> None:
        collector = collector_with_chain()

        contexts = collector.used_contexts()

        assert DynamicGlobalPropertiesClassifier in contexts
        assert len(contexts) == 1

    def test_upvote_account_adds_account_classifier(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})
        contexts = collector.used_contexts()

        assert len(contexts) == 2
        ctx_entry = contexts[1]
        assert ctx_entry["class"] is AccountClassifier
        assert ctx_entry["options"]["account"] == "alice"

    def test_rc_account_adds_rc_classifier(self) -> None:
        collector = collector_with_chain()

        collector.push_options({"account": "bob", "manabar_type": ManabarType.RC})
        contexts = collector.used_contexts()

        assert len(contexts) == 2
        ctx_entry = contexts[1]
        assert ctx_entry["class"] is RcAccountClassifier
        assert ctx_entry["options"]["rc_account"] == "bob"


# ---------------------------------------------------------------------------
# Tests: get() — upvote calculation
# ---------------------------------------------------------------------------


class TestManabarCollectorUpvote:
    @pytest.mark.asyncio
    async def test_upvote_50_percent(self) -> None:
        collector = collector_with_chain(regen_fraction=0.0)
        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        ctx = manabar_context(
            accounts={
                "alice": account_manabar_data(
                    "alice",
                    upvote_current=5000,
                    upvote_max=10000,
                    upvote_last_update=SOURCE_LAST_UPDATE,
                )
            },
        )

        result = await collector.get(ctx)
        manabar_data = _manabar_data(result)

        assert "alice" in manabar_data
        entry = manabar_data["alice"][ManabarType.UPVOTE]
        assert entry["percent"] == 50.0
        assert entry["current_mana"] == 5000
        assert entry["max"] == 10000
        assert entry["last_update_time"] == SOURCE_LAST_UPDATE_TIME

    @pytest.mark.asyncio
    async def test_upvote_full_mana(self) -> None:
        ctx = manabar_context(accounts={"alice": account_manabar_data("alice", upvote_current=10000, upvote_max=10000)})
        entry = await _collect_entry(account="alice", manabar_type=ManabarType.UPVOTE, ctx=ctx)
        assert entry["percent"] == 100.0

    @pytest.mark.asyncio
    async def test_upvote_with_regeneration(self) -> None:
        ctx = manabar_context(accounts={"alice": account_manabar_data("alice", upvote_current=5000, upvote_max=10000)})
        entry = await _collect_entry(
            account="alice",
            manabar_type=ManabarType.UPVOTE,
            ctx=ctx,
            regen_fraction=0.2,
        )
        assert entry["percent"] == 70.0
        assert entry["current_mana"] == 7000

    @pytest.mark.asyncio
    async def test_upvote_reports_source_last_update_time(self) -> None:
        ctx = manabar_context(
            accounts={
                "alice": account_manabar_data(
                    "alice",
                    upvote_current=5000,
                    upvote_max=10000,
                    upvote_last_update=SOURCE_LAST_UPDATE,
                )
            },
        )

        entry = await _collect_entry(account="alice", manabar_type=ManabarType.UPVOTE, ctx=ctx)

        assert entry["last_update_time"] == SOURCE_LAST_UPDATE_TIME


# ---------------------------------------------------------------------------
# Tests: get() — downvote calculation
# ---------------------------------------------------------------------------


class TestManabarCollectorDownvote:
    @pytest.mark.asyncio
    async def test_downvote_applies_pool_percent(self) -> None:
        # effective_max = 1_000_000 * 2500 // 10000 = 250_000 (small number path)
        # downvote_current = 125_000 → 50%
        ctx = manabar_context(
            dgp=dynamic_global_properties_data(downvote_pool_percent=2500),
            accounts={
                "alice": account_manabar_data(
                    "alice",
                    upvote_max=1_000_000,
                    downvote_current=125_000,
                )
            },
        )
        entry = await _collect_entry(account="alice", manabar_type=ManabarType.DOWNVOTE, ctx=ctx)

        effective_max = 1_000_000 * 2500 // ONE_HUNDRED_PERCENT
        assert entry["max"] == effective_max
        assert entry["current_mana"] == 125_000
        assert entry["percent"] == 50.0

    @pytest.mark.asyncio
    async def test_downvote_large_max_uses_division_path(self) -> None:
        large_max = ONE_HUNDRED_PERCENT * (ONE_HUNDRED_PERCENT + 1)
        ctx = manabar_context(
            dgp=dynamic_global_properties_data(downvote_pool_percent=25),
            accounts={
                "alice": account_manabar_data(
                    "alice",
                    upvote_max=large_max,
                    downvote_current=1000,
                )
            },
        )
        entry = await _collect_entry(account="alice", manabar_type=ManabarType.DOWNVOTE, ctx=ctx)

        expected_max = (large_max // ONE_HUNDRED_PERCENT) * 25
        assert entry["max"] == expected_max


# ---------------------------------------------------------------------------
# Tests: get() — RC calculation
# ---------------------------------------------------------------------------


class TestManabarCollectorRC:
    @pytest.mark.asyncio
    async def test_rc_calculation(self) -> None:
        ctx = manabar_context(rc_accounts={"alice": rc_account_manabar_data("alice", current=8000, max_rc=10000)})
        entry = await _collect_entry(account="alice", manabar_type=ManabarType.RC, ctx=ctx)
        assert entry["percent"] == 80.0
        assert entry["current_mana"] == 8000
        assert entry["max"] == 10000

    @pytest.mark.asyncio
    async def test_rc_missing_account_returns_zero(self) -> None:
        ctx = manabar_context(rc_accounts={})
        entry = await _collect_entry(account="unknown", manabar_type=ManabarType.RC, ctx=ctx)
        assert entry["percent"] == 0.0
        assert entry["current_mana"] == 0
        assert entry["max"] == 0


# ---------------------------------------------------------------------------
# Tests: edge cases
# ---------------------------------------------------------------------------


class TestManabarCollectorEdgeCases:
    @pytest.mark.asyncio
    async def test_zero_max_mana_no_division_error(self) -> None:
        ctx = manabar_context(accounts={"alice": account_manabar_data("alice", upvote_current=0, upvote_max=0)})
        entry = await _collect_entry(account="alice", manabar_type=ManabarType.UPVOTE, ctx=ctx)
        assert entry["percent"] == 0.0
        assert entry["max"] == 0

    @pytest.mark.asyncio
    async def test_missing_account_returns_zero_entry(self) -> None:
        ctx = manabar_context(accounts={})
        entry = await _collect_entry(account="ghost", manabar_type=ManabarType.UPVOTE, ctx=ctx)
        assert entry["percent"] == 0.0
        assert entry["current_mana"] == 0
        assert entry["max"] == 0
        assert entry["last_update_time"] == HEAD_TIME

    @pytest.mark.asyncio
    async def test_multiple_accounts_multiple_types(self) -> None:
        collector = collector_with_chain()
        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})
        collector.push_options({"account": "bob", "manabar_type": ManabarType.RC})

        ctx = manabar_context(
            accounts={"alice": account_manabar_data("alice", upvote_current=9000, upvote_max=10000)},
            rc_accounts={"bob": rc_account_manabar_data("bob", current=5000, max_rc=10000)},
        )

        result = await collector.get(ctx)
        manabar_data = _manabar_data(result)
        assert manabar_data["alice"][ManabarType.UPVOTE]["percent"] == 90.0
        assert manabar_data["bob"][ManabarType.RC]["percent"] == 50.0

    @pytest.mark.asyncio
    async def test_no_subscriptions_returns_empty(self) -> None:
        collector = collector_with_chain()

        ctx = manabar_context()

        result = await collector.get(ctx)
        manabar_data = _manabar_data(result)
        assert manabar_data == {}


# ---------------------------------------------------------------------------
# Tests: result shape validation
# ---------------------------------------------------------------------------


class TestManabarCollectorResultShape:
    @pytest.mark.asyncio
    async def test_result_has_correct_keys(self) -> None:
        collector = collector_with_chain()
        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        ctx = manabar_context(accounts={"alice": account_manabar_data("alice")})

        result = await collector.get(ctx)

        assert ManabarClassifier.__name__ in result
        assert "manabar_data" in result[ManabarClassifier.__name__]

        entry = _manabar_entry(result, "alice", ManabarType.UPVOTE)
        assert "percent" in entry
        assert "current_mana" in entry
        assert "max" in entry
        assert "last_update_time" in entry

    @pytest.mark.asyncio
    async def test_result_types_correct(self) -> None:
        ctx = manabar_context(accounts={"alice": account_manabar_data("alice")})
        entry = await _collect_entry(account="alice", manabar_type=ManabarType.UPVOTE, ctx=ctx)

        assert isinstance(entry["percent"], float)
        assert isinstance(entry["current_mana"], int)
        assert isinstance(entry["max"], int)
        assert isinstance(entry["last_update_time"], datetime)

    @pytest.mark.asyncio
    async def test_percent_in_range_0_100(self) -> None:
        ctx = manabar_context(accounts={"alice": account_manabar_data("alice", upvote_current=9000, upvote_max=10000)})
        entry = await _collect_entry(
            account="alice",
            manabar_type=ManabarType.UPVOTE,
            ctx=ctx,
            regen_fraction=0.5,
        )

        assert 0.0 <= entry["percent"] <= 100.0

    @pytest.mark.asyncio
    async def test_timing_recorded(self) -> None:
        collector = collector_with_chain()
        collector.push_options({"account": "alice", "manabar_type": ManabarType.UPVOTE})

        ctx = manabar_context(accounts={"alice": account_manabar_data("alice")})

        await collector.get(ctx)

        timing_labels = [t[0] for t in ctx.timings]
        assert "calculate_current_manabar_value" in timing_labels
