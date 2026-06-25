"""Tests for individual filter classes.

Each test builds a minimal DataEvaluationContext, injects the classifiers
the filter depends on with stub collectors that return synthetic data,
then calls ``await filter.match(ctx)`` and checks the result.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.block_header_classifier import BlockHeaderClassifier
from workerbee.chain_observers.classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from workerbee.chain_observers.classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from workerbee.chain_observers.classifiers.feed_price_classifier import FeedPriceClassifier
from workerbee.chain_observers.classifiers.manabar_classifier import ManabarClassifier
from workerbee.chain_observers.classifiers.operation_classifier import OperationClassifier
from workerbee.chain_observers.classifiers.witness_classifier import WitnessClassifier
from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.filters.account_created_filter import AccountCreatedFilter
from workerbee.chain_observers.filters.account_full_manabar_filter import AccountFullManabarFilter
from workerbee.chain_observers.filters.account_metadata_change_filter import AccountMetadataChangeFilter
from workerbee.chain_observers.filters.alarm_filter import AlarmFilter
from workerbee.chain_observers.filters.balance_change_filter import BalanceChangeFilter
from workerbee.chain_observers.filters.block_filter import BlockNumberFilter
from workerbee.chain_observers.filters.blog_content_filter import CommentFilter, PostFilter
from workerbee.chain_observers.filters.composite_filter import LogicalAndFilter, LogicalOrFilter
from workerbee.chain_observers.filters.custom_operation_filter import CustomOperationFilter
from workerbee.chain_observers.filters.exchange_transfer_filter import ExchangeTransferFilter
from workerbee.chain_observers.filters.feed_price_change_percent_filter import FeedPriceChangeFilter
from workerbee.chain_observers.filters.feed_price_no_change_filter import FeedPriceNoChangeFilter
from workerbee.chain_observers.filters.filter_base import FilterBase
from workerbee.chain_observers.filters.follow_filter import FollowFilter
from workerbee.chain_observers.filters.internal_market_filter import InternalMarketFilter
from workerbee.chain_observers.filters.new_block_filter import BlockChangedFilter
from workerbee.chain_observers.filters.post_mention_filter import PostMentionFilter
from workerbee.chain_observers.filters.reblog_filter import ReblogFilter
from workerbee.chain_observers.filters.vote_filter import VoteFilter
from workerbee.chain_observers.filters.whale_alert_filter import WhaleAlertFilter
from workerbee.chain_observers.filters.witness_miss_block_filter import WitnessMissedBlocksFilter
from workerbee.chain_observers.payloads import OperationsPerType

from .conftest import make_data_context

# ---------------------------------------------------------------------------
# Helpers — lightweight stubs
# ---------------------------------------------------------------------------


def _block_header_data(number: int = 100, witness: str = "witness-a") -> dict[str, Any]:
    """Return the dict the BlockHeaderCollector normally produces."""
    return {
        BlockHeaderClassifier.__name__: {
            "number": number,
            "witness": witness,
            "timestamp": "2024-06-15T12:00:00",
            "id": "abc123",
        },
    }


def _operation_data(ops_per_type: OperationsPerType) -> dict[str, Any]:
    """Build the dict that OperationCollector normally returns."""
    all_ops: list[Any] = []
    for _type_name, entries in ops_per_type.items():
        all_ops.extend(entries)
    return {
        OperationClassifier.__name__: {
            "operations": all_ops,
            "operations_per_type": ops_per_type,
        },
    }


# ---------------------------------------------------------------------------
# BlockChangedFilter
# ---------------------------------------------------------------------------


class TestBlockChangedFilter:
    @pytest.mark.asyncio
    async def test_first_call_returns_true(self) -> None:
        ctx = make_data_context((BlockHeaderClassifier, _block_header_data(100)))
        filt = BlockChangedFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_same_block_returns_false(self) -> None:
        filt = BlockChangedFilter()
        ctx1 = make_data_context((BlockHeaderClassifier, _block_header_data(100)))
        await filt.match(ctx1)  # first call -> True

        ctx2 = make_data_context((BlockHeaderClassifier, _block_header_data(100)))
        assert await filt.match(ctx2) is False

    @pytest.mark.asyncio
    async def test_new_block_returns_true(self) -> None:
        filt = BlockChangedFilter()
        ctx1 = make_data_context((BlockHeaderClassifier, _block_header_data(100)))
        await filt.match(ctx1)

        ctx2 = make_data_context((BlockHeaderClassifier, _block_header_data(101)))
        assert await filt.match(ctx2) is True


# ---------------------------------------------------------------------------
# BlockNumberFilter
# ---------------------------------------------------------------------------


class TestBlockNumberFilter:
    @pytest.mark.asyncio
    async def test_matches_target_number(self) -> None:
        ctx = make_data_context((BlockHeaderClassifier, _block_header_data(42)))
        filt = BlockNumberFilter(42)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_other_number(self) -> None:
        ctx = make_data_context((BlockHeaderClassifier, _block_header_data(99)))
        filt = BlockNumberFilter(42)
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# VoteFilter
# ---------------------------------------------------------------------------


class TestVoteFilter:
    @pytest.mark.asyncio
    async def test_matches_voter(self) -> None:
        ops = {
            "vote_operation": [
                {"operation": {"voter": "alice", "author": "bob", "permlink": "post1", "weight": 10000}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = VoteFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_other_voter(self) -> None:
        ops = {
            "vote_operation": [
                {"operation": {"voter": "charlie", "author": "bob", "permlink": "post1", "weight": 10000}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = VoteFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_no_votes_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = VoteFilter(["alice"])
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# PostFilter
# ---------------------------------------------------------------------------


class TestPostFilter:
    @pytest.mark.asyncio
    async def test_matches_post_from_author(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {
                        "author": "bob",
                        "parent_author": "",
                        "parent_permlink": "hive-196917",
                        "permlink": "my-post",
                        "title": "Hello",
                        "body": "World",
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostFilter(["bob"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_comment_as_post(self) -> None:
        """comment_operation with non-empty parent_author is a comment, not a post."""
        ops = {
            "comment_operation": [
                {
                    "operation": {
                        "author": "bob",
                        "parent_author": "alice",
                        "parent_permlink": "parent-post",
                        "permlink": "reply",
                        "title": "",
                        "body": "reply",
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostFilter(["bob"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_rejects_wrong_author(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {"author": "charlie", "parent_author": "", "parent_permlink": "hive", "permlink": "p", "title": "T", "body": "B"},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostFilter(["bob"])
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# CommentFilter
# ---------------------------------------------------------------------------


class TestCommentFilter:
    @pytest.mark.asyncio
    async def test_matches_comment_from_author(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {"author": "bob", "parent_author": "alice", "parent_permlink": "parent", "permlink": "reply", "title": "", "body": "comment"},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = CommentFilter(["bob"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_post_as_comment(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {"author": "bob", "parent_author": "", "parent_permlink": "hive", "permlink": "post", "title": "T", "body": "B"},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = CommentFilter(["bob"])
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# AccountCreatedFilter
# ---------------------------------------------------------------------------


class TestAccountCreatedFilter:
    @pytest.mark.asyncio
    async def test_matches_account_create(self) -> None:
        ops = {
            "account_create_operation": [
                {"operation": {"creator": "alice", "new_account_name": "newuser"}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = AccountCreatedFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_account_create_with_delegation(self) -> None:
        ops = {
            "account_create_with_delegation_operation": [
                {"operation": {"creator": "alice", "new_account_name": "delegated-user"}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = AccountCreatedFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_create_claimed_account(self) -> None:
        ops = {
            "create_claimed_account_operation": [
                {"operation": {"creator": "alice", "new_account_name": "newuser"}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = AccountCreatedFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_no_creation_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = AccountCreatedFilter()
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# CustomOperationFilter
# ---------------------------------------------------------------------------


class TestCustomOperationFilter:
    @pytest.mark.asyncio
    async def test_matches_custom_json_with_id(self) -> None:
        ops = {
            "custom_json_operation": [
                {"operation": {"id": "follow", "json": '["follow",{}]', "required_auths": [], "required_posting_auths": ["alice"]}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = CustomOperationFilter(["follow"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_different_id(self) -> None:
        ops = {
            "custom_json_operation": [
                {"operation": {"id": "reblog", "json": '["reblog",{}]', "required_auths": [], "required_posting_auths": ["alice"]}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = CustomOperationFilter(["follow"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_no_custom_ops_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = CustomOperationFilter(["follow"])
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# ExchangeTransferFilter
# ---------------------------------------------------------------------------


class TestExchangeTransferFilter:
    @pytest.mark.asyncio
    async def test_matches_transfer_to_exchange(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "alice", "to": "binance-hot2", "amount": "10.000 HIVE"}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = ExchangeTransferFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_transfer_from_exchange(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "binance-hot2", "to": "alice", "amount": "5.000 HIVE"}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = ExchangeTransferFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_non_exchange_transfer(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "alice", "to": "bob", "amount": "1.000 HIVE"}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = ExchangeTransferFilter()
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_no_transfers_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = ExchangeTransferFilter()
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# InternalMarketFilter
# ---------------------------------------------------------------------------


class TestInternalMarketFilter:
    @pytest.mark.asyncio
    async def test_matches_limit_order_create(self) -> None:
        ops = {
            "limit_order_create_operation": [
                {"operation": {"owner": "alice", "orderid": 1}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = InternalMarketFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_limit_order_create2(self) -> None:
        ops = {
            "limit_order_create2_operation": [
                {"operation": {"owner": "alice", "orderid": 1}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = InternalMarketFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_limit_order_cancel(self) -> None:
        ops = {
            "limit_order_cancel_operation": [
                {"operation": {"owner": "alice", "orderid": 1}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = InternalMarketFilter()
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_no_market_ops_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = InternalMarketFilter()
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# AlarmFilter
# ---------------------------------------------------------------------------


def _alarm_account_data(
    name: str = "alice",
    *,
    recovery_account: str = "hive.fund",
    governance_vote_expiration: datetime | None = datetime(2099, 1, 1, tzinfo=UTC),
) -> dict[str, Any]:
    return {
        AccountClassifier.__name__: {
            "accounts": {
                name: {
                    "name": name,
                    "recovery_account": recovery_account,
                    "governance_vote_expiration": governance_vote_expiration,
                },
            },
        },
    }


def _change_recovery_data(*accounts: str) -> dict[str, Any]:
    return {
        ChangeRecoveryInProgressClassifier.__name__: {
            "recovering_accounts": dict.fromkeys(accounts, True),
        },
    }


def _decline_voting_rights_data(*accounts: str) -> dict[str, Any]:
    return {
        DeclineVotingRightsClassifier.__name__: {
            "decline_voting_rights_accounts": dict.fromkeys(accounts, True),
        },
    }


class TestAlarmFilter:
    @pytest.mark.asyncio
    async def test_matches_legacy_recovery_account(self) -> None:
        ctx = make_data_context((AccountClassifier, _alarm_account_data(recovery_account="steem")))
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_missing_governance_vote(self) -> None:
        ctx = make_data_context((AccountClassifier, _alarm_account_data(governance_vote_expiration=None)))
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_governance_vote_expiring_soon(self) -> None:
        expiring_soon = datetime.now(UTC) + timedelta(days=14)
        ctx = make_data_context((AccountClassifier, _alarm_account_data(governance_vote_expiration=expiring_soon)))
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_healthy_account(self) -> None:
        ctx = make_data_context(
            (AccountClassifier, _alarm_account_data()),
            (ChangeRecoveryInProgressClassifier, _change_recovery_data()),
            (DeclineVotingRightsClassifier, _decline_voting_rights_data()),
        )
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_matches_recovery_request(self) -> None:
        ctx = make_data_context(
            (AccountClassifier, _alarm_account_data()),
            (ChangeRecoveryInProgressClassifier, _change_recovery_data("alice")),
        )
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_matches_decline_voting_rights_request(self) -> None:
        ctx = make_data_context(
            (AccountClassifier, _alarm_account_data()),
            (ChangeRecoveryInProgressClassifier, _change_recovery_data()),
            (DeclineVotingRightsClassifier, _decline_voting_rights_data("alice")),
        )
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_missing_account(self) -> None:
        ctx = make_data_context(
            (
                AccountClassifier,
                {
                    AccountClassifier.__name__: {
                        "accounts": {},
                    },
                },
            )
        )
        filt = AlarmFilter(["alice"])
        assert await filt.match(ctx) is False

    def test_registers_account_recovery_and_decline_contexts(self) -> None:
        filt = AlarmFilter(["alice"])
        contexts = filt.used_contexts()
        classifier_classes = {ctx["class"] if isinstance(ctx, dict) else ctx for ctx in contexts}
        assert classifier_classes == {
            AccountClassifier,
            ChangeRecoveryInProgressClassifier,
            DeclineVotingRightsClassifier,
        }


# ---------------------------------------------------------------------------
# LogicalAndFilter / LogicalOrFilter
# ---------------------------------------------------------------------------


class _ConfigurableFilter(FilterBase):
    """Filter whose match result can be set."""

    def __init__(self, result: bool) -> None:
        super().__init__()
        self._result = result

    async def match(self, data: Any) -> bool:
        return self._result


class _RaisingFilter(FilterBase):
    """Filter that raises from match()."""

    async def match(self, data: Any) -> bool:
        raise RuntimeError("filter exploded")


class _DelayedRaisingFilter(FilterBase):
    async def match(self, data: Any) -> bool:
        await asyncio.sleep(0)
        raise RuntimeError("filter exploded")


class _NeverSettlingFilter(FilterBase):
    def __init__(self) -> None:
        super().__init__()
        self.started = asyncio.Event()
        self.cancelled = asyncio.Event()

    async def match(self, data: Any) -> bool:
        self.started.set()
        try:
            await asyncio.Event().wait()
        finally:
            self.cancelled.set()


class _RecordingFilter(FilterBase):
    def __init__(self, result: bool, calls: list[str], name: str) -> None:
        super().__init__()
        self._result = result
        self._calls = calls
        self._name = name

    async def match(self, data: Any) -> bool:
        self._calls.append(self._name)
        return self._result


class TestLogicalAndFilter:
    @pytest.mark.asyncio
    async def test_both_true(self) -> None:
        ctx = make_data_context()
        filt = LogicalAndFilter([_ConfigurableFilter(True), _ConfigurableFilter(True)])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_one_false(self) -> None:
        ctx = make_data_context()
        filt = LogicalAndFilter([_ConfigurableFilter(True), _ConfigurableFilter(False)])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_starts_all_operands_like_typescript(self) -> None:
        ctx = make_data_context()
        calls: list[str] = []
        filt = LogicalAndFilter([_RecordingFilter(False, calls, "first"), _RecordingFilter(True, calls, "second")])
        assert await filt.match(ctx) is False
        assert calls == ["first", "second"]

    @pytest.mark.asyncio
    async def test_false_operand_wins_over_later_error_like_typescript(self) -> None:
        ctx = make_data_context()
        filt = LogicalAndFilter([_ConfigurableFilter(False), _DelayedRaisingFilter()])
        assert await filt.match(ctx) is False
        await asyncio.sleep(0)

    @pytest.mark.asyncio
    async def test_false_operand_cancels_never_settling_loser(self) -> None:
        ctx = make_data_context()
        loser = _NeverSettlingFilter()
        filt = LogicalAndFilter([_ConfigurableFilter(False), loser])

        assert await filt.match(ctx) is False
        assert loser.started.is_set()
        await asyncio.wait_for(loser.cancelled.wait(), timeout=1)

    @pytest.mark.asyncio
    async def test_both_false(self) -> None:
        ctx = make_data_context()
        filt = LogicalAndFilter([_ConfigurableFilter(False), _ConfigurableFilter(False)])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_operand_error_propagates(self) -> None:
        ctx = make_data_context()
        filt = LogicalAndFilter([_ConfigurableFilter(True), _RaisingFilter()])
        with pytest.raises(RuntimeError, match="filter exploded"):
            await filt.match(ctx)


class TestLogicalOrFilter:
    @pytest.mark.asyncio
    async def test_one_true(self) -> None:
        ctx = make_data_context()
        filt = LogicalOrFilter([_ConfigurableFilter(False), _ConfigurableFilter(True)])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_both_true(self) -> None:
        ctx = make_data_context()
        filt = LogicalOrFilter([_ConfigurableFilter(True), _ConfigurableFilter(True)])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_starts_all_operands_like_typescript(self) -> None:
        ctx = make_data_context()
        calls: list[str] = []
        filt = LogicalOrFilter([_RecordingFilter(True, calls, "first"), _RecordingFilter(False, calls, "second")])
        assert await filt.match(ctx) is True
        assert calls == ["first", "second"]

    @pytest.mark.asyncio
    async def test_true_operand_wins_over_later_error_like_typescript(self) -> None:
        ctx = make_data_context()
        filt = LogicalOrFilter([_ConfigurableFilter(True), _DelayedRaisingFilter()])
        assert await filt.match(ctx) is True
        await asyncio.sleep(0)

    @pytest.mark.asyncio
    async def test_true_operand_cancels_never_settling_loser(self) -> None:
        ctx = make_data_context()
        loser = _NeverSettlingFilter()
        filt = LogicalOrFilter([_ConfigurableFilter(True), loser])

        assert await filt.match(ctx) is True
        assert loser.started.is_set()
        await asyncio.wait_for(loser.cancelled.wait(), timeout=1)

    @pytest.mark.asyncio
    async def test_both_false_returns_false(self) -> None:
        """OR must reject an event when none of its operands match."""
        ctx = make_data_context()
        filt = LogicalOrFilter([_ConfigurableFilter(False), _ConfigurableFilter(False)])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_operand_error_propagates(self) -> None:
        ctx = make_data_context()
        filt = LogicalOrFilter([_ConfigurableFilter(False), _RaisingFilter()])
        with pytest.raises(RuntimeError, match="filter exploded"):
            await filt.match(ctx)


# ---------------------------------------------------------------------------
# WitnessMissedBlocksFilter
# ---------------------------------------------------------------------------


def _witness_data(
    name: str = "gtg",
    *,
    total_missed_blocks: int = 0,
    last_confirmed_block_num: int = 100,
) -> dict[str, Any]:
    return {
        WitnessClassifier.__name__: {
            "witnesses": {
                name: {
                    "owner": name,
                    "total_missed_blocks": total_missed_blocks,
                    "last_confirmed_block_num": last_confirmed_block_num,
                },
            },
        },
    }


class TestWitnessMissedBlocksFilter:
    @pytest.mark.asyncio
    async def test_first_call_initializes_without_match(self) -> None:
        ctx = make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=5, last_confirmed_block_num=100)))
        filt = WitnessMissedBlocksFilter(["gtg"], missed_blocks_count_min=3)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_matches_when_missed_blocks_exceed_threshold_without_new_block(self) -> None:
        filt = WitnessMissedBlocksFilter(["gtg"], missed_blocks_count_min=2)
        await filt.match(make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=5, last_confirmed_block_num=100))))

        ctx = make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=8, last_confirmed_block_num=100)))
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_when_missed_blocks_stay_below_threshold(self) -> None:
        filt = WitnessMissedBlocksFilter(["gtg"], missed_blocks_count_min=5)
        await filt.match(make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=5, last_confirmed_block_num=100))))

        ctx = make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=8, last_confirmed_block_num=100)))
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_new_confirmed_block_resets_missed_block_streak(self) -> None:
        filt = WitnessMissedBlocksFilter(["gtg"], missed_blocks_count_min=2)
        await filt.match(make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=5, last_confirmed_block_num=100))))

        ctx = make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=6, last_confirmed_block_num=101)))
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_missing_witness_is_ignored(self) -> None:
        ctx = make_data_context(
            (
                WitnessClassifier,
                {
                    WitnessClassifier.__name__: {
                        "witnesses": {},
                    },
                },
            )
        )
        filt = WitnessMissedBlocksFilter(["gtg"], missed_blocks_count_min=1)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_same_missed_block_streak_does_not_fire_twice(self) -> None:
        filt = WitnessMissedBlocksFilter(["gtg"], missed_blocks_count_min=2)
        await filt.match(make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=5, last_confirmed_block_num=100))))

        assert await filt.match(make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=8, last_confirmed_block_num=100)))) is True
        assert await filt.match(make_data_context((WitnessClassifier, _witness_data(total_missed_blocks=10, last_confirmed_block_num=100)))) is False

    def test_registers_one_witness_context_per_tracked_witness(self) -> None:
        filt = WitnessMissedBlocksFilter(["gtg", "blocktrades"], missed_blocks_count_min=1)
        contexts = filt.used_contexts()
        assert [ctx["class"] for ctx in contexts if isinstance(ctx, dict)] == [WitnessClassifier, WitnessClassifier]


# ---------------------------------------------------------------------------
# BalanceChangeFilter
# ---------------------------------------------------------------------------


def _account_data(
    name: str = "alice",
    hive_total: str = "1000",
    hbd_total: str = "500",
    hp_total: str = "2000",
) -> dict[str, Any]:
    """Build the dict that AccountCollector returns, keyed by AccountClassifier name."""
    balance = {
        "HIVE": {
            "liquid": SimpleNamespace(amount=hive_total, precision=3, nai="@@000000021"),
            "total": SimpleNamespace(amount=hive_total, precision=3, nai="@@000000021"),
        },
        "HBD": {
            "liquid": SimpleNamespace(amount=hbd_total, precision=3, nai="@@000000013"),
            "total": SimpleNamespace(amount=hbd_total, precision=3, nai="@@000000013"),
        },
        "HP": {
            "liquid": SimpleNamespace(amount=hp_total, precision=3, nai="@@000000037"),
            "total": SimpleNamespace(amount=hp_total, precision=3, nai="@@000000037"),
        },
    }
    account = {"name": name, "balance": balance}
    return {
        AccountClassifier.__name__: {
            "accounts": {name: account},
        },
    }


def _multi_account_data(*account_payloads: dict[str, Any]) -> dict[str, Any]:
    accounts: dict[str, Any] = {}
    for payload in account_payloads:
        accounts.update(payload[AccountClassifier.__name__]["accounts"])
    return {AccountClassifier.__name__: {"accounts": accounts}}


def _account_metadata_data(
    name: str,
    json_metadata: dict[str, Any],
    posting_json_metadata: dict[str, Any],
) -> dict[str, Any]:
    return {
        AccountClassifier.__name__: {
            "accounts": {
                name: {
                    "name": name,
                    "json_metadata": json_metadata,
                    "posting_json_metadata": posting_json_metadata,
                },
            },
        },
    }


class TestBalanceChangeFilter:
    @pytest.mark.asyncio
    async def test_first_call_stores_balance_returns_false(self) -> None:
        """First call initialises previous_balance and returns False."""
        ctx = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        filt = BalanceChangeFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_same_balance_returns_false(self) -> None:
        filt = BalanceChangeFilter(["alice"])
        ctx1 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        await filt.match(ctx1)  # init

        ctx2 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        assert await filt.match(ctx2) is False

    @pytest.mark.asyncio
    async def test_different_hive_balance_returns_true(self) -> None:
        filt = BalanceChangeFilter(["alice"])
        ctx1 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        await filt.match(ctx1)  # init

        ctx2 = make_data_context((AccountClassifier, _account_data("alice", "2000", "500", "2000")))
        assert await filt.match(ctx2) is True

    @pytest.mark.asyncio
    async def test_different_hbd_balance_returns_true(self) -> None:
        filt = BalanceChangeFilter(["alice"])
        ctx1 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        await filt.match(ctx1)

        ctx2 = make_data_context((AccountClassifier, _account_data("alice", "1000", "999", "2000")))
        assert await filt.match(ctx2) is True

    @pytest.mark.asyncio
    async def test_different_hp_balance_returns_true(self) -> None:
        filt = BalanceChangeFilter(["alice"])
        ctx1 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        await filt.match(ctx1)

        ctx2 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "3000")))
        assert await filt.match(ctx2) is True

    @pytest.mark.asyncio
    async def test_uses_account_classifier_in_contexts(self) -> None:
        filt = BalanceChangeFilter(["alice"])
        contexts = filt.used_contexts()
        assert len(contexts) == 1
        assert contexts[0]["class"] is AccountClassifier

    @pytest.mark.asyncio
    async def test_account_not_found_returns_false(self) -> None:
        """When the account is not in the data, match returns False."""
        data = {
            AccountClassifier.__name__: {
                "accounts": {},
            },
        }
        ctx = make_data_context((AccountClassifier, data))
        filt = BalanceChangeFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_include_internal_transfers(self) -> None:
        """With include_internal_transfers, any sub-field change triggers True."""
        filt = BalanceChangeFilter(["alice"], include_internal_transfers=True)
        ctx1 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        await filt.match(ctx1)  # init

        ctx2 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        assert await filt.match(ctx2) is False

    @pytest.mark.asyncio
    async def test_include_internal_transfers_changed(self) -> None:
        filt = BalanceChangeFilter(["alice"], include_internal_transfers=True)
        ctx1 = make_data_context((AccountClassifier, _account_data("alice", "1000", "500", "2000")))
        await filt.match(ctx1)  # init

        ctx2 = make_data_context((AccountClassifier, _account_data("alice", "999", "500", "2000")))
        assert await filt.match(ctx2) is True

    @pytest.mark.asyncio
    async def test_multi_account_same_balances_are_tracked_per_account(self) -> None:
        filt = BalanceChangeFilter(["alice", "bob"])
        data = _multi_account_data(
            _account_data("alice", "1000", "500", "2000"),
            _account_data("bob", "3000", "700", "4000"),
        )

        await filt.match(make_data_context((AccountClassifier, data)))

        assert await filt.match(make_data_context((AccountClassifier, data))) is False

    @pytest.mark.asyncio
    async def test_multi_account_internal_transfer_change_in_second_account_matches(self) -> None:
        filt = BalanceChangeFilter(["alice", "bob"], include_internal_transfers=True)
        before = _multi_account_data(
            _account_data("alice", "1000", "500", "2000"),
            _account_data("bob", "3000", "700", "4000"),
        )
        after = _multi_account_data(
            _account_data("alice", "1000", "500", "2000"),
            _account_data("bob", "3001", "700", "4000"),
        )

        await filt.match(make_data_context((AccountClassifier, before)))

        assert await filt.match(make_data_context((AccountClassifier, after))) is True


class TestAccountMetadataChangeFilter:
    @pytest.mark.asyncio
    async def test_multi_account_same_metadata_is_tracked_per_account(self) -> None:
        filt = AccountMetadataChangeFilter(["alice", "bob"])
        data = _multi_account_data(
            _account_metadata_data("alice", {"profile": {"name": "Alice"}}, {"app": "one"}),
            _account_metadata_data("bob", {"profile": {"name": "Bob"}}, {"app": "two"}),
        )

        await filt.match(make_data_context((AccountClassifier, data)))

        assert await filt.match(make_data_context((AccountClassifier, data))) is False

    @pytest.mark.parametrize(
        ("bob_json_metadata", "bob_posting_json_metadata"),
        [
            ({"profile": {"name": "Bob updated"}}, {"app": "two"}),
            ({"profile": {"name": "Bob"}}, {"app": "three"}),
        ],
        ids=["json_metadata", "posting_json_metadata"],
    )
    @pytest.mark.asyncio
    async def test_multi_account_second_account_metadata_change_matches(
        self,
        bob_json_metadata: dict[str, Any],
        bob_posting_json_metadata: dict[str, Any],
    ) -> None:
        filt = AccountMetadataChangeFilter(["alice", "bob"])
        before = _multi_account_data(
            _account_metadata_data("alice", {"profile": {"name": "Alice"}}, {"app": "one"}),
            _account_metadata_data("bob", {"profile": {"name": "Bob"}}, {"app": "two"}),
        )
        after = _multi_account_data(
            _account_metadata_data("alice", {"profile": {"name": "Alice"}}, {"app": "one"}),
            _account_metadata_data("bob", bob_json_metadata, bob_posting_json_metadata),
        )

        await filt.match(make_data_context((AccountClassifier, before)))

        assert await filt.match(make_data_context((AccountClassifier, after))) is True


# ---------------------------------------------------------------------------
# AccountFullManabarFilter
# ---------------------------------------------------------------------------


def _manabar_data(
    account: str = "alice",
    manabar_type: int = ManabarType.UPVOTE,
    current_mana: int = 900,
    max_mana: int = 1000,
    percent: float = 90.0,
) -> dict[str, Any]:
    """Build ManabarClassifier data."""
    manabar = {"current_mana": current_mana, "max": max_mana, "percent": percent, "last_update_time": 0}
    return {
        ManabarClassifier.__name__: {
            "manabar_data": {
                account: {
                    manabar_type: manabar,
                },
            },
        },
    }


class TestAccountFullManabarFilter:
    @pytest.mark.asyncio
    async def test_manabar_above_threshold_returns_true(self) -> None:
        ctx = make_data_context((ManabarClassifier, _manabar_data("alice", ManabarType.UPVOTE, 980, 1000, 98)))
        filt = AccountFullManabarFilter(["alice"], ManabarType.UPVOTE, 98)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_manabar_below_threshold_returns_false(self) -> None:
        ctx = make_data_context((ManabarClassifier, _manabar_data("alice", ManabarType.UPVOTE, 900, 1000, 50)))
        filt = AccountFullManabarFilter(["alice"], ManabarType.UPVOTE, 98)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_max_mana_zero_returns_true(self) -> None:
        """When max == 0, always returns True (no mana to track)."""
        ctx = make_data_context((ManabarClassifier, _manabar_data("alice", ManabarType.UPVOTE, 0, 0, 0)))
        filt = AccountFullManabarFilter(["alice"], ManabarType.UPVOTE, 98)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_uses_manabar_classifier_in_contexts(self) -> None:
        filt = AccountFullManabarFilter(["alice"], ManabarType.UPVOTE, 98)
        contexts = filt.used_contexts()
        assert len(contexts) == 1
        assert contexts[0]["class"] is ManabarClassifier

    @pytest.mark.asyncio
    async def test_account_not_found_returns_false(self) -> None:
        data = {
            ManabarClassifier.__name__: {
                "manabar_data": {},
            },
        }
        ctx = make_data_context((ManabarClassifier, data))
        filt = AccountFullManabarFilter(["alice"], ManabarType.UPVOTE, 98)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_manabar_type_not_found_returns_false(self) -> None:
        """Account exists but the specific manabar type is missing."""
        data = {
            ManabarClassifier.__name__: {
                "manabar_data": {
                    "alice": {},
                },
            },
        }
        ctx = make_data_context((ManabarClassifier, data))
        filt = AccountFullManabarFilter(["alice"], ManabarType.UPVOTE, 98)
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# FeedPriceChangeFilter
# ---------------------------------------------------------------------------


def _feed_price_entry(base_amount: str = "330", quote_amount: str = "1000") -> SimpleNamespace:
    return SimpleNamespace(
        base=SimpleNamespace(amount=base_amount, precision=3, nai="@@000000013"),
        quote=SimpleNamespace(amount=quote_amount, precision=3, nai="@@000000021"),
    )


def _feed_price_data(
    price_history: list[object] | None = None,
    timestamp: datetime | None = None,
) -> dict[str, Any]:
    if price_history is None:
        price_history = []
    if timestamp is None:
        timestamp = datetime(2024, 6, 15, 12, 0, 0)
    return {
        FeedPriceClassifier.__name__: {
            "price_history": price_history,
            "current_median_history": price_history[0] if price_history else None,
            "last_feed_price_retrieval_timestamp": timestamp,
        },
    }


class TestFeedPriceChangeFilter:
    @pytest.mark.asyncio
    async def test_first_call_no_history_returns_false(self) -> None:
        """With fewer than 2 entries in history, returns False."""
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data([])))
        filt = FeedPriceChangeFilter(5.0)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_single_entry_returns_false(self) -> None:
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data([_feed_price_entry("330", "1000")])))
        filt = FeedPriceChangeFilter(5.0)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_same_price_returns_false(self) -> None:
        """Two identical prices -> 0% change."""
        history = [_feed_price_entry("330", "1000"), _feed_price_entry("330", "1000")]
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data(history)))
        filt = FeedPriceChangeFilter(5.0)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_price_change_above_threshold_returns_true(self) -> None:
        """10% change >= 5% threshold."""
        # price1 = 330/1000 = 0.33, price2 = 300/1000 = 0.30
        # percent_change = abs(0.33 - 0.30) / 0.30 * 100 = 10%
        history = [_feed_price_entry("330", "1000"), _feed_price_entry("300", "1000")]
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data(history)))
        filt = FeedPriceChangeFilter(5.0)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_price_change_below_threshold_returns_false(self) -> None:
        """~1% change < 5% threshold."""
        # price1 = 330/1000 = 0.33, price2 = 327/1000 = 0.327
        # percent_change = abs(0.33 - 0.327) / 0.327 * 100 ≈ 0.917%
        history = [_feed_price_entry("330", "1000"), _feed_price_entry("327", "1000")]
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data(history)))
        filt = FeedPriceChangeFilter(5.0)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_stale_timestamp_returns_false(self) -> None:
        """If previous timestamp is newer than current, return False."""
        filt = FeedPriceChangeFilter(5.0)
        # First call sets _previous_update_timestamp
        ts1 = datetime(2024, 6, 15, 14, 0, 0)
        history = [_feed_price_entry("330", "1000"), _feed_price_entry("300", "1000")]
        ctx1 = make_data_context((FeedPriceClassifier, _feed_price_data(history, ts1)))
        await filt.match(ctx1)

        # Second call with older timestamp
        ts2 = datetime(2024, 6, 15, 12, 0, 0)
        ctx2 = make_data_context((FeedPriceClassifier, _feed_price_data(history, ts2)))
        assert await filt.match(ctx2) is False


# ---------------------------------------------------------------------------
# FeedPriceNoChangeFilter
# ---------------------------------------------------------------------------


class TestFeedPriceNoChangeFilter:
    @pytest.mark.asyncio
    async def test_empty_history_returns_false(self) -> None:
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data([])))
        filt = FeedPriceNoChangeFilter(24)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_single_entry_returns_false(self) -> None:
        """Only one entry means no pair to compare, price_changed stays False."""
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data([_feed_price_entry("330", "1000")])))
        filt = FeedPriceNoChangeFilter(24)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_same_prices_within_interval_returns_false(self) -> None:
        """Same prices but fewer entries than threshold → price_changed is False."""
        # 2 entries same price, threshold is 24 → index only reaches 1 (< 24)
        history = [_feed_price_entry("330", "1000"), _feed_price_entry("330", "1000")]
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data(history)))
        filt = FeedPriceNoChangeFilter(24)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_same_prices_across_full_interval_returns_false(self) -> None:
        """TS-compatible legacy behavior: unchanged window does not fire."""
        history = [
            _feed_price_entry("330", "1000"),
            _feed_price_entry("330", "1000"),
            _feed_price_entry("330", "1000"),
        ]
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data(history)))
        filt = FeedPriceNoChangeFilter(2)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_price_changes_returns_true(self) -> None:
        """If a price changes in history, price_changed = True → returns True.
        Uses values where integer division produces different results."""
        # 1500 // 1000 = 1, 500 // 1000 = 0 → different → price_changed = True
        history = [_feed_price_entry("1500", "1000"), _feed_price_entry("500", "1000")]
        ctx = make_data_context((FeedPriceClassifier, _feed_price_data(history)))
        filt = FeedPriceNoChangeFilter(24)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_stale_timestamp_returns_false(self) -> None:
        """If previous timestamp is newer than current, return False."""
        filt = FeedPriceNoChangeFilter(24)
        ts1 = datetime(2024, 6, 15, 14, 0, 0)
        history = [_feed_price_entry("330", "1000"), _feed_price_entry("300", "1000")]
        ctx1 = make_data_context((FeedPriceClassifier, _feed_price_data(history, ts1)))
        await filt.match(ctx1)

        ts2 = datetime(2024, 6, 15, 12, 0, 0)
        ctx2 = make_data_context((FeedPriceClassifier, _feed_price_data(history, ts2)))
        assert await filt.match(ctx2) is False


# ---------------------------------------------------------------------------
# FollowFilter
# ---------------------------------------------------------------------------


class TestFollowFilter:
    @pytest.mark.asyncio
    async def test_matches_follow_operation(self) -> None:
        ops = {
            "custom_json_operation": [
                {
                    "operation": {
                        "id": "follow",
                        "json": '["follow", {"follower": "alice", "following": "bob", "what": ["blog"]}]',
                        "required_auths": [],
                        "required_posting_auths": ["alice"],
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = FollowFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_wrong_follower(self) -> None:
        ops = {
            "custom_json_operation": [
                {
                    "operation": {
                        "id": "follow",
                        "json": '["follow", {"follower": "bob", "following": "charlie", "what": ["blog"]}]',
                        "required_auths": [],
                        "required_posting_auths": ["bob"],
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = FollowFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_rejects_reblog_op(self) -> None:
        """custom_json with id=follow but json[0]='reblog' is not a follow."""
        ops = {
            "custom_json_operation": [
                {
                    "operation": {
                        "id": "follow",
                        "json": '["reblog", {"account": "alice", "author": "bob", "permlink": "p1"}]',
                        "required_auths": [],
                        "required_posting_auths": ["alice"],
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = FollowFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_no_custom_json_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = FollowFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_malformed_json_returns_false(self) -> None:
        ops = {
            "custom_json_operation": [
                {"operation": {"id": "follow", "json": "not valid json", "required_auths": [], "required_posting_auths": ["alice"]}, "transaction": {}},
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = FollowFilter(["alice"])
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# ReblogFilter
# ---------------------------------------------------------------------------


class TestReblogFilter:
    @pytest.mark.asyncio
    async def test_matches_reblog_operation(self) -> None:
        ops = {
            "custom_json_operation": [
                {
                    "operation": {
                        "id": "follow",
                        "json": '["reblog", {"account": "alice", "author": "bob", "permlink": "p1"}]',
                        "required_auths": [],
                        "required_posting_auths": ["alice"],
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = ReblogFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_rejects_wrong_account(self) -> None:
        ops = {
            "custom_json_operation": [
                {
                    "operation": {
                        "id": "follow",
                        "json": '["reblog", {"account": "bob", "author": "charlie", "permlink": "p1"}]',
                        "required_auths": [],
                        "required_posting_auths": ["bob"],
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = ReblogFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_rejects_follow_op(self) -> None:
        """custom_json with id=follow but json[0]='follow' is not a reblog."""
        ops = {
            "custom_json_operation": [
                {
                    "operation": {
                        "id": "follow",
                        "json": '["follow", {"follower": "alice", "following": "bob", "what": ["blog"]}]',
                        "required_auths": [],
                        "required_posting_auths": ["alice"],
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = ReblogFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_no_custom_json_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = ReblogFilter(["alice"])
        assert await filt.match(ctx) is False


# ---------------------------------------------------------------------------
# PostMentionFilter
# ---------------------------------------------------------------------------


class TestPostMentionFilter:
    @pytest.mark.asyncio
    async def test_matches_mention_in_body(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {
                        "author": "bob",
                        "parent_author": "",
                        "parent_permlink": "hive",
                        "permlink": "post1",
                        "title": "Hello",
                        "body": "Great post by @alice on the topic!",
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostMentionFilter(["alice"])
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_no_mention_returns_false(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {
                        "author": "bob",
                        "parent_author": "",
                        "parent_permlink": "hive",
                        "permlink": "post1",
                        "title": "Hello",
                        "body": "Great post with no mentions here!",
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostMentionFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_wrong_mention_returns_false(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {
                        "author": "bob",
                        "parent_author": "",
                        "parent_permlink": "hive",
                        "permlink": "post1",
                        "title": "Hello",
                        "body": "Thanks @charlie for the support!",
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostMentionFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_no_comment_ops_returns_false(self) -> None:
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = PostMentionFilter(["alice"])
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_multiple_mentions_one_matches(self) -> None:
        ops = {
            "comment_operation": [
                {
                    "operation": {
                        "author": "bob",
                        "parent_author": "",
                        "parent_permlink": "hive",
                        "permlink": "post1",
                        "title": "Hello",
                        "body": "Thanks @charlie and @alice for everything!",
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = PostMentionFilter(["alice"])
        assert await filt.match(ctx) is True


# ---------------------------------------------------------------------------
# WhaleAlertFilter
# ---------------------------------------------------------------------------


class TestWhaleAlertFilter:
    @pytest.mark.asyncio
    async def test_transfer_above_threshold_returns_true(self) -> None:
        threshold = SimpleNamespace(amount="10000", nai="@@000000021")
        ops = {
            "transfer_operation": [
                {
                    "operation": {"from": "alice", "to": "bob", "amount": SimpleNamespace(amount="50000", nai="@@000000021")},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_transfer_below_threshold_returns_false(self) -> None:
        threshold = SimpleNamespace(amount="50000", nai="@@000000021")
        ops = {
            "transfer_operation": [
                {
                    "operation": {"from": "alice", "to": "bob", "amount": SimpleNamespace(amount="403", nai="@@000000021")},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_different_nai_returns_false(self) -> None:
        """Threshold is HIVE but transfer is HBD."""
        threshold = SimpleNamespace(amount="10000", nai="@@000000021")
        ops = {
            "transfer_operation": [
                {
                    "operation": {"from": "alice", "to": "bob", "amount": SimpleNamespace(amount="50000", nai="@@000000013")},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_escrow_hbd_amount_matches(self) -> None:
        threshold = SimpleNamespace(amount="10000", nai="@@000000013")
        ops = {
            "escrow_transfer_operation": [
                {
                    "operation": {
                        "from": "alice",
                        "to": "bob",
                        "hbd_amount": SimpleNamespace(amount="50000", nai="@@000000013"),
                        "hive_amount": SimpleNamespace(amount="0", nai="@@000000021"),
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_escrow_hive_amount_matches(self) -> None:
        threshold = SimpleNamespace(amount="10000", nai="@@000000021")
        ops = {
            "escrow_transfer_operation": [
                {
                    "operation": {
                        "from": "alice",
                        "to": "bob",
                        "hbd_amount": SimpleNamespace(amount="0", nai="@@000000013"),
                        "hive_amount": SimpleNamespace(amount="50000", nai="@@000000021"),
                    },
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_no_transfers_returns_false(self) -> None:
        threshold = SimpleNamespace(amount="10000", nai="@@000000021")
        ctx = make_data_context((OperationClassifier, _operation_data({})))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is False

    @pytest.mark.asyncio
    async def test_transfer_from_savings_matches(self) -> None:
        threshold = SimpleNamespace(amount="10000", nai="@@000000021")
        ops = {
            "transfer_from_savings_operation": [
                {
                    "operation": {"from": "alice", "to": "bob", "amount": SimpleNamespace(amount="20000", nai="@@000000021")},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_recurrent_transfer_matches(self) -> None:
        threshold = SimpleNamespace(amount="10000", nai="@@000000021")
        ops = {
            "recurrent_transfer_operation": [
                {
                    "operation": {"from": "alice", "to": "bob", "amount": SimpleNamespace(amount="20000", nai="@@000000021")},
                    "transaction": {},
                },
            ],
        }
        ctx = make_data_context((OperationClassifier, _operation_data(ops)))
        filt = WhaleAlertFilter(threshold)
        assert await filt.match(ctx) is True
