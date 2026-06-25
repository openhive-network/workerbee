"""Tests for AlarmProvider — governance, recovery, and decline voting rights alarms."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from workerbee.chain_observers.classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from workerbee.chain_observers.providers.alarm_provider import (
    AlarmProvider,
    AlarmType,
)

# ═══════════════════════════════════════════════════════════════════
# Fakes
# ═══════════════════════════════════════════════════════════════════


class FakeAlarmDataContext:
    """Simulates DataEvaluationContext for alarm provider tests."""

    def __init__(
        self,
        accounts: dict[str, dict[str, object]] | None = None,
        recovering_accounts: dict[str, object] | None = None,
        decline_accounts: dict[str, object] | None = None,
    ) -> None:
        self._accounts = accounts or {}
        self._recovering = recovering_accounts or {}
        self._decline = decline_accounts or {}

    async def get(self, classifier: type) -> dict[str, object]:
        if classifier is AccountClassifier:
            return {"accounts": self._accounts}
        if classifier is ChangeRecoveryInProgressClassifier:
            return {"recovering_accounts": self._recovering}
        if classifier is DeclineVotingRightsClassifier:
            return {"decline_voting_rights_accounts": self._decline}
        return {}

    async def query(self, classifier: type, options: object) -> object:
        return {}


# ═══════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════


class TestAlarmProviderOptions:
    def test_pushOptions_adds_accounts(self) -> None:
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice", "bob"]})
        assert provider.accounts == {"alice", "bob"}

    def test_pushOptions_accumulates(self) -> None:
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})
        provider.push_options({"accounts": ["bob"]})
        assert provider.accounts == {"alice", "bob"}

    def test_pushOptions_empty_raises(self) -> None:
        provider = AlarmProvider()
        with pytest.raises(ValueError, match="accounts must not be empty"):
            provider.push_options({"accounts": []})

    def test_usedContexts_returns_three_classifiers_per_account(self) -> None:
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})
        contexts = provider.used_contexts()
        assert len(contexts) == 3
        classifier_classes = {ctx["class"] if isinstance(ctx, dict) else ctx for ctx in contexts}
        assert AccountClassifier in classifier_classes
        assert ChangeRecoveryInProgressClassifier in classifier_classes
        assert DeclineVotingRightsClassifier in classifier_classes

    def test_usedContexts_scales_with_accounts(self) -> None:
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice", "bob"]})
        contexts = provider.used_contexts()
        assert len(contexts) == 6


class TestAlarmProviderLegacyRecovery:
    @pytest.mark.asyncio
    async def test_steem_recovery_triggers_alarm(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "steem", "governance_vote_expiration": None}},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"]["alice"]
        assert AlarmType.LEGACY_RECOVERY_ACCOUNT_SET in alarms

    @pytest.mark.asyncio
    async def test_non_steem_recovery_no_alarm(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": None}},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"].get("alice", [])
        assert AlarmType.LEGACY_RECOVERY_ACCOUNT_SET not in alarms


class TestAlarmProviderGovernance:
    @pytest.mark.asyncio
    async def test_none_governance_triggers_expired(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": None}},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"]["alice"]
        assert AlarmType.GOVERNANCE_VOTE_EXPIRED in alarms

    @pytest.mark.asyncio
    async def test_expiration_soon_triggers_alarm(self) -> None:
        soon = datetime.now(UTC) + timedelta(days=14)
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": soon}},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"]["alice"]
        assert alarms == [AlarmType.GOVERNANCE_VOTE_EXPIRATION_SOON]

    @pytest.mark.asyncio
    async def test_far_future_expiration_no_alarm(self) -> None:
        far_future = datetime(2099, 1, 1, tzinfo=UTC)
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": far_future}},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"].get("alice", [])
        assert AlarmType.GOVERNANCE_VOTE_EXPIRATION_SOON not in alarms
        assert AlarmType.GOVERNANCE_VOTE_EXPIRED not in alarms


class TestAlarmProviderRecoveryInProgress:
    @pytest.mark.asyncio
    async def test_recovery_in_progress_triggers_alarm(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": datetime(2099, 1, 1, tzinfo=UTC)}},
            recovering_accounts={"alice": True},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"]["alice"]
        assert AlarmType.RECOVERY_ACCOUNT_IS_CHANGING in alarms

    @pytest.mark.asyncio
    async def test_no_recovery_in_progress_no_alarm(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": datetime(2099, 1, 1, tzinfo=UTC)}},
            recovering_accounts={},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"].get("alice", [])
        assert AlarmType.RECOVERY_ACCOUNT_IS_CHANGING not in alarms


class TestAlarmProviderDeclineVotingRights:
    @pytest.mark.asyncio
    async def test_decline_voting_rights_triggers_alarm(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": datetime(2099, 1, 1, tzinfo=UTC)}},
            decline_accounts={"alice": True},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"]["alice"]
        assert AlarmType.DECLINING_VOTING_RIGHTS in alarms

    @pytest.mark.asyncio
    async def test_no_decline_no_alarm(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "hive.fund", "governance_vote_expiration": datetime(2099, 1, 1, tzinfo=UTC)}},
            decline_accounts={},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"].get("alice", [])
        assert AlarmType.DECLINING_VOTING_RIGHTS not in alarms


class TestAlarmProviderMultipleAlarms:
    @pytest.mark.asyncio
    async def test_multiple_alarms_for_same_account(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "steem", "governance_vote_expiration": None}},
            recovering_accounts={"alice": True},
            decline_accounts={"alice": True},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        alarms = result["alarms_per_account"]["alice"]
        assert AlarmType.LEGACY_RECOVERY_ACCOUNT_SET in alarms
        assert AlarmType.GOVERNANCE_VOTE_EXPIRED in alarms
        assert AlarmType.RECOVERY_ACCOUNT_IS_CHANGING in alarms
        assert AlarmType.DECLINING_VOTING_RIGHTS in alarms
        assert len(alarms) == 4

    @pytest.mark.asyncio
    async def test_multiple_accounts(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={
                "alice": {"recovery_account": "steem", "governance_vote_expiration": datetime(2099, 1, 1, tzinfo=UTC)},
                "bob": {"recovery_account": "hive.fund", "governance_vote_expiration": None},
            },
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice", "bob"]})

        result = await provider.provide(ctx)
        alice_alarms = result["alarms_per_account"]["alice"]
        bob_alarms = result["alarms_per_account"]["bob"]
        assert AlarmType.LEGACY_RECOVERY_ACCOUNT_SET in alice_alarms
        assert AlarmType.GOVERNANCE_VOTE_EXPIRED in bob_alarms


class TestAlarmProviderEdgeCases:
    @pytest.mark.asyncio
    async def test_missing_account_in_data(self) -> None:
        ctx = FakeAlarmDataContext(accounts={})
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        assert result["alarms_per_account"] == {}

    @pytest.mark.asyncio
    async def test_no_accounts_configured(self) -> None:
        ctx = FakeAlarmDataContext(accounts={})
        provider = AlarmProvider()
        provider.accounts = set()

        result = await provider.provide(ctx)
        assert result["alarms_per_account"] == {}

    @pytest.mark.asyncio
    async def test_result_shape_uses_enum_values(self) -> None:
        ctx = FakeAlarmDataContext(
            accounts={"alice": {"recovery_account": "steem", "governance_vote_expiration": None}},
        )
        provider = AlarmProvider()
        provider.push_options({"accounts": ["alice"]})

        result = await provider.provide(ctx)
        assert "alarms_per_account" in result
        assert isinstance(result["alarms_per_account"], dict)
        valid_alarms = set(AlarmType)
        for alarms in result["alarms_per_account"].values():
            assert isinstance(alarms, list)
            for alarm in alarms:
                assert alarm in valid_alarms, f"Unexpected alarm value: {alarm}"
