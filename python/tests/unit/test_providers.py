"""Tests for provider classes.

Each test builds a minimal DataEvaluationContext, injects the classifiers
the provider depends on with stub collectors returning synthetic data,
then calls ``await provider.provide(ctx)`` and checks the returned dict.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from workerbee.chain_observers.classifiers.block_classifier import BlockClassifier
from workerbee.chain_observers.classifiers.block_header_classifier import BlockHeaderClassifier
from workerbee.chain_observers.classifiers.operation_classifier import OperationClassifier
from workerbee.chain_observers.factories.data_evaluation_context import DataEvaluationContext
from workerbee.chain_observers.payloads import OperationsPerType
from workerbee.chain_observers.providers.block_header_provider import BlockHeaderProvider
from workerbee.chain_observers.providers.block_provider import BlockProvider
from workerbee.chain_observers.providers.comment_provider import CommentProvider
from workerbee.chain_observers.providers.custom_operation_provider import CustomOperationProvider
from workerbee.chain_observers.providers.exchange_transfer_provider import ExchangeTransferProvider
from workerbee.chain_observers.providers.follow_provider import FollowProvider
from workerbee.chain_observers.providers.internal_market_provider import InternalMarketProvider
from workerbee.chain_observers.providers.mention_provider import MentionedAccountProvider
from workerbee.chain_observers.providers.new_account_provider import NewAccountProvider
from workerbee.chain_observers.providers.post_provider import PostProvider
from workerbee.chain_observers.providers.reblog_provider import ReblogProvider
from workerbee.chain_observers.providers.vote_provider import VoteProvider
from workerbee.chain_observers.providers.whale_alert_provider import WhaleAlertProvider

from .conftest import make_data_context

# ---------------------------------------------------------------------------
# Helpers — lightweight stubs
# ---------------------------------------------------------------------------


def _block_header_data(
    number: int = 100,
    witness: str = "witness-a",
    timestamp: str = "2024-06-15T12:00:00",
    block_id: str = "abc123",
) -> dict[str, Any]:
    """Return the dict that BlockHeaderCollector normally produces."""
    return {
        BlockHeaderClassifier.__name__: {
            "number": number,
            "witness": witness,
            "timestamp": timestamp,
            "id": block_id,
        },
    }


def _block_data(
    transactions: list[dict[str, Any]] | None = None,
    transactions_per_id: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the dict that BlockCollector normally produces."""
    return {
        BlockClassifier.__name__: {
            "transactions": transactions or [],
            "transactions_per_id": transactions_per_id or {},
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


def _operation_ctx(ops_per_type: OperationsPerType) -> DataEvaluationContext:
    return make_data_context((OperationClassifier, _operation_data(ops_per_type)))


async def _provide_operations(provider: Any, ops_per_type: OperationsPerType, options: dict[str, Any] | None = None) -> dict[str, Any]:
    if options is not None:
        provider.push_options(options)
    return await provider.provide(_operation_ctx(ops_per_type))


def _comment_op(
    *,
    author: str,
    parent_author: str = "",
    parent_permlink: str = "hive",
    permlink: str = "p1",
    title: str = "T",
    body: str = "B",
    tx_id: str = "tx1",
) -> dict[str, Any]:
    return {
        "operation": {
            "author": author,
            "parent_author": parent_author,
            "parent_permlink": parent_permlink,
            "permlink": permlink,
            "title": title,
            "body": body,
        },
        "transaction": {"id": tx_id},
    }


def _custom_json_op(*, json_id: str, posting_auth: str = "alice", tx_id: str = "tx1", json_payload: str | None = None) -> dict[str, Any]:
    return {
        "operation": {
            "id": json_id,
            "json": json_payload if json_payload is not None else f'["{json_id}",{{}}]',
            "required_auths": [],
            "required_posting_auths": [posting_auth],
        },
        "transaction": {"id": tx_id},
    }


def _asset(amount: int, nai: str = "@@000000021") -> dict[str, int | str]:
    return {"amount": amount, "nai": nai, "precision": 3}


# ---------------------------------------------------------------------------
# BlockHeaderProvider
# ---------------------------------------------------------------------------


class TestBlockHeaderProvider:
    @pytest.mark.asyncio
    async def test_returns_block_header_fields(self) -> None:
        ctx = make_data_context((BlockHeaderClassifier, _block_header_data(42, "witness-b", "2024-07-01T00:00:00", "def456")))
        provider = BlockHeaderProvider()
        result = await provider.provide(ctx)

        assert "block" in result
        assert result["block"]["number"] == 42
        assert result["block"]["witness"] == "witness-b"
        assert result["block"]["timestamp"] == "2024-07-01T00:00:00"
        assert result["block"]["id"] == "def456"

    @pytest.mark.asyncio
    async def test_block_dict_is_a_copy(self) -> None:
        """The returned dict should be a fresh copy via {**block_header}."""
        ctx = make_data_context((BlockHeaderClassifier, _block_header_data()))
        provider = BlockHeaderProvider()
        r1 = await provider.provide(ctx)
        r2 = await provider.provide(ctx)
        assert r1["block"] is not r2["block"]

    @pytest.mark.asyncio
    async def test_used_contexts(self) -> None:
        provider = BlockHeaderProvider()
        contexts = provider.used_contexts()
        assert BlockHeaderClassifier in contexts


# ---------------------------------------------------------------------------
# BlockProvider
# ---------------------------------------------------------------------------


class TestBlockProvider:
    @pytest.mark.asyncio
    async def test_merges_header_and_block(self) -> None:
        header = _block_header_data(50, "witness-c")
        block = _block_data(
            transactions=[{"transaction": {"operations": []}, "id": "tx1"}],
            transactions_per_id={"tx1": {"operations": []}},
        )
        ctx = make_data_context(
            (BlockHeaderClassifier, header),
            (BlockClassifier, block),
        )
        provider = BlockProvider()
        result = await provider.provide(ctx)

        assert "block" in result
        # Header fields present
        assert result["block"]["number"] == 50
        assert result["block"]["witness"] == "witness-c"
        # Block fields present
        assert "transactions" in result["block"]
        assert len(result["block"]["transactions"]) == 1
        assert "transactions_per_id" in result["block"]

    @pytest.mark.asyncio
    async def test_used_contexts(self) -> None:
        provider = BlockProvider()
        contexts = provider.used_contexts()
        assert BlockHeaderClassifier in contexts
        assert BlockClassifier in contexts


# ---------------------------------------------------------------------------
# VoteProvider
# ---------------------------------------------------------------------------


class TestVoteProvider:
    @pytest.mark.asyncio
    async def test_groups_votes_by_voter(self) -> None:
        ops = {
            "vote_operation": [
                {"operation": {"voter": "alice", "author": "bob", "permlink": "p1", "weight": 10000}, "transaction": {"id": "tx1"}},
                {"operation": {"voter": "alice", "author": "carol", "permlink": "p2", "weight": 5000}, "transaction": {"id": "tx2"}},
            ],
        }
        result = await _provide_operations(VoteProvider(), ops, {"voters": ["alice"]})

        assert "votes" in result
        assert "alice" in result["votes"]
        assert len(result["votes"]["alice"]) == 2

    @pytest.mark.asyncio
    async def test_filters_by_registered_voters(self) -> None:
        ops = {
            "vote_operation": [
                {"operation": {"voter": "alice", "author": "bob", "permlink": "p1", "weight": 10000}, "transaction": {"id": "tx1"}},
                {"operation": {"voter": "carol", "author": "bob", "permlink": "p1", "weight": 10000}, "transaction": {"id": "tx2"}},
            ],
        }
        result = await _provide_operations(VoteProvider(), ops, {"voters": ["alice"]})

        assert "alice" in result["votes"]
        assert "carol" not in result["votes"]

    @pytest.mark.asyncio
    async def test_no_votes_returns_empty_dict(self) -> None:
        result = await _provide_operations(VoteProvider(), {}, {"voters": ["alice"]})

        assert result == {"votes": {}}

    @pytest.mark.asyncio
    async def test_empty_voter_options_are_noop(self) -> None:
        result = await _provide_operations(VoteProvider(), {}, {"voters": []})

        assert result == {"votes": {}}

    @pytest.mark.asyncio
    async def test_multiple_push_options_accumulates_voters(self) -> None:
        provider = VoteProvider()
        provider.push_options({"voters": ["alice"]})
        provider.push_options({"voters": ["bob"]})
        assert provider.voters == {"alice", "bob"}


# ---------------------------------------------------------------------------
# PostProvider
# ---------------------------------------------------------------------------


class TestPostProvider:
    @pytest.mark.asyncio
    async def test_groups_posts_by_author(self) -> None:
        ops = {
            "comment_operation": [
                _comment_op(author="bob", permlink="p1", title="T", body="B", tx_id="tx1"),
                _comment_op(author="bob", permlink="p2", title="T2", body="B2", tx_id="tx2"),
            ],
        }
        result = await _provide_operations(PostProvider(), ops, {"authors": ["bob"]})

        assert "posts" in result
        assert "bob" in result["posts"]
        assert len(result["posts"]["bob"]) == 2

    @pytest.mark.asyncio
    async def test_excludes_comments(self) -> None:
        """comment_operation with non-empty parent_author is a comment, not a post."""
        ops = {
            "comment_operation": [
                _comment_op(
                    author="bob",
                    parent_author="alice",
                    parent_permlink="parent",
                    permlink="reply",
                    title="",
                    body="r",
                ),
            ],
        }
        result = await _provide_operations(PostProvider(), ops, {"authors": ["bob"]})

        assert result == {"posts": {}}

    @pytest.mark.asyncio
    async def test_filters_by_registered_authors(self) -> None:
        ops = {
            "comment_operation": [
                _comment_op(author="bob", permlink="p1", title="T", body="B", tx_id="tx1"),
                _comment_op(author="carol", permlink="p2", title="T2", body="B2", tx_id="tx2"),
            ],
        }
        result = await _provide_operations(PostProvider(), ops, {"authors": ["bob"]})

        assert "bob" in result["posts"]
        assert "carol" not in result["posts"]

    @pytest.mark.asyncio
    async def test_no_comment_ops_returns_empty(self) -> None:
        result = await _provide_operations(PostProvider(), {}, {"authors": ["bob"]})

        assert result == {"posts": {}}


# ---------------------------------------------------------------------------
# CommentProvider
# ---------------------------------------------------------------------------


class TestCommentProvider:
    @pytest.mark.asyncio
    async def test_groups_comments_by_author(self) -> None:
        """comment_operation with non-empty parent_author is a reply, grouped by author."""
        ops = {
            "comment_operation": [
                _comment_op(author="bob", parent_author="alice", parent_permlink="root", permlink="r1", title="", body="hi"),
                _comment_op(author="bob", parent_author="carol", parent_permlink="root2", permlink="r2", title="", body="yo", tx_id="tx2"),
            ],
        }
        result = await _provide_operations(CommentProvider(), ops, {"authors": [{"account": "bob"}]})

        assert "comments" in result
        assert len(result["comments"]["bob"]) == 2

    @pytest.mark.asyncio
    async def test_excludes_posts(self) -> None:
        """comment_operation with empty parent_author is a post, not a comment."""
        ops = {
            "comment_operation": [
                _comment_op(author="bob", permlink="p1", title="T", body="B"),
            ],
        }
        result = await _provide_operations(CommentProvider(), ops, {"authors": [{"account": "bob"}]})

        assert result == {"comments": {}}

    @pytest.mark.asyncio
    async def test_parent_comment_filter_matches_and_skips(self) -> None:
        """parent_comment_filter keeps replies under the matching parent_permlink only."""
        ops = {
            "comment_operation": [
                _comment_op(author="bob", parent_author="alice", parent_permlink="wanted", permlink="r1", title="", body="x"),
                _comment_op(author="bob", parent_author="alice", parent_permlink="other", permlink="r2", title="", body="y", tx_id="tx2"),
            ],
        }
        result = await _provide_operations(
            CommentProvider(),
            ops,
            {"authors": [{"account": "bob", "parent_comment_filter": {"parent_permlink": "wanted"}}]},
        )

        assert len(result["comments"]["bob"]) == 1
        assert result["comments"]["bob"][0]["operation"]["parent_permlink"] == "wanted"

    @pytest.mark.asyncio
    async def test_filters_by_registered_authors(self) -> None:
        ops = {
            "comment_operation": [
                _comment_op(author="carol", parent_author="alice", parent_permlink="root", permlink="r1", title="", body="z"),
            ],
        }
        result = await _provide_operations(CommentProvider(), ops, {"authors": [{"account": "bob"}]})

        assert result == {"comments": {}}


# ---------------------------------------------------------------------------
# MentionedAccountProvider
# ---------------------------------------------------------------------------


class TestMentionedAccountProvider:
    @pytest.mark.asyncio
    async def test_groups_comment_with_tracked_mention(self) -> None:
        ops = {
            "comment_operation": [
                _comment_op(author="bob", body="Hey @alice, check this post.", tx_id="tx1"),
            ],
        }
        result = await _provide_operations(MentionedAccountProvider(), ops, {"accounts": ["alice"]})

        assert [entry["author"] for entry in result["mentioned"]["alice"]] == ["bob"]

    @pytest.mark.asyncio
    async def test_rejects_comment_without_tracked_mention(self) -> None:
        ops = {
            "comment_operation": [
                _comment_op(author="bob", body="Hey @carol, check this post.", tx_id="tx1"),
            ],
        }
        result = await _provide_operations(MentionedAccountProvider(), ops, {"accounts": ["alice"]})

        assert result == {"mentioned": {}}


# ---------------------------------------------------------------------------
# NewAccountProvider
# ---------------------------------------------------------------------------


class TestNewAccountProvider:
    @pytest.mark.asyncio
    async def test_extracts_from_account_create(self) -> None:
        ops = {
            "account_create_operation": [
                {
                    "operation": {
                        "creator": "alice",
                        "new_account_name": "newuser",
                        "memo_key": "STM...",
                        "json_metadata": '{"profile":{"name":"New User"}}',
                    },
                    "transaction": {"id": "tx1"},
                },
            ],
        }
        result = await _provide_operations(NewAccountProvider(), ops)

        assert "new_accounts" in result
        assert len(result["new_accounts"]) == 1
        acct = result["new_accounts"][0]
        assert acct["account_name"] == "newuser"
        assert acct["creator"] == "alice"
        assert acct["memo"] == "STM..."
        assert acct["json_metadata"]["profile"]["name"] == "New User"

    @pytest.mark.asyncio
    async def test_extracts_from_account_create_with_delegation(self) -> None:
        ops = {
            "account_create_with_delegation_operation": [
                {
                    "operation": {
                        "creator": "alice",
                        "new_account_name": "delegated-user",
                        "memo_key": "STM...",
                        "json_metadata": '{"profile":{"name":"Delegated User"}}',
                    },
                    "transaction": {"id": "tx-delegation"},
                },
            ],
        }
        result = await _provide_operations(NewAccountProvider(), ops)

        assert result["new_accounts"] == [
            {
                "account_name": "delegated-user",
                "active": None,
                "creator": "alice",
                "json_metadata": {"profile": {"name": "Delegated User"}},
                "memo": "STM...",
                "owner": None,
                "posting": None,
            }
        ]

    @pytest.mark.asyncio
    async def test_extracts_from_create_claimed_account(self) -> None:
        ops = {
            "create_claimed_account_operation": [
                {
                    "operation": {
                        "creator": "bob",
                        "new_account_name": "claimed-user",
                        "memo_key": "STM...",
                        "json_metadata": "",
                    },
                    "transaction": {"id": "tx2"},
                },
            ],
        }
        result = await _provide_operations(NewAccountProvider(), ops)

        assert len(result["new_accounts"]) == 1
        assert result["new_accounts"][0]["account_name"] == "claimed-user"
        assert result["new_accounts"][0]["json_metadata"] == {}

    @pytest.mark.asyncio
    async def test_handles_invalid_json_metadata(self) -> None:
        ops = {
            "account_create_operation": [
                {
                    "operation": {
                        "creator": "alice",
                        "new_account_name": "u1",
                        "memo_key": "STM...",
                        "json_metadata": "not-valid-json{{{",
                    },
                    "transaction": {"id": "tx3"},
                },
            ],
        }
        result = await _provide_operations(NewAccountProvider(), ops)

        assert len(result["new_accounts"]) == 1
        assert result["new_accounts"][0]["json_metadata"] == {}

    @pytest.mark.asyncio
    async def test_no_creation_ops_returns_empty(self) -> None:
        result = await _provide_operations(NewAccountProvider(), {})

        assert result == {"new_accounts": []}

    @pytest.mark.asyncio
    async def test_combines_multiple_creation_types(self) -> None:
        ops = {
            "account_create_operation": [
                {"operation": {"creator": "a", "new_account_name": "u1", "memo_key": "k1"}, "transaction": {}},
            ],
            "create_claimed_account_operation": [
                {"operation": {"creator": "b", "new_account_name": "u2", "memo_key": "k2"}, "transaction": {}},
            ],
        }
        result = await _provide_operations(NewAccountProvider(), ops)

        names = [a["account_name"] for a in result["new_accounts"]]
        assert "u1" in names
        assert "u2" in names


# ---------------------------------------------------------------------------
# ExchangeTransferProvider
# ---------------------------------------------------------------------------


class TestExchangeTransferProvider:
    @pytest.mark.asyncio
    async def test_detects_transfer_to_exchange(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "alice", "to": "binance-hot2", "amount": "10.000 HIVE"}, "transaction": {"id": "tx1"}},
            ],
        }
        result = await _provide_operations(ExchangeTransferProvider(), ops)

        assert "exchange_transfer_operations" in result
        assert len(result["exchange_transfer_operations"]) == 1
        entry = result["exchange_transfer_operations"][0]
        assert entry["operation"]["from"] == "alice"
        assert entry["operation"]["to"] == "binance-hot2"
        assert entry["operation"]["exchange"] == "Binance"

    @pytest.mark.asyncio
    async def test_detects_transfer_from_exchange(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "huobi-pro", "to": "bob", "amount": "5.000 HIVE"}, "transaction": {"id": "tx2"}},
            ],
        }
        result = await _provide_operations(ExchangeTransferProvider(), ops)

        assert len(result["exchange_transfer_operations"]) == 1
        assert result["exchange_transfer_operations"][0]["operation"]["exchange"] == "HTX"

    @pytest.mark.asyncio
    async def test_ignores_non_exchange_transfer(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "alice", "to": "bob", "amount": "1.000 HIVE"}, "transaction": {"id": "tx3"}},
            ],
        }
        result = await _provide_operations(ExchangeTransferProvider(), ops)

        assert result == {"exchange_transfer_operations": []}

    @pytest.mark.asyncio
    async def test_handles_recurrent_transfer(self) -> None:
        ops = {
            "recurrent_transfer_operation": [
                {"operation": {"from": "alice", "to": "binance-hot2", "amount": "2.000 HIVE"}, "transaction": {"id": "tx4"}},
            ],
        }
        result = await _provide_operations(ExchangeTransferProvider(), ops)

        assert len(result["exchange_transfer_operations"]) == 1

    @pytest.mark.asyncio
    async def test_handles_escrow_transfer(self) -> None:
        ops = {
            "escrow_transfer_operation": [
                {"operation": {"from": "alice", "to": "user.dunamu", "hbd_amount": "100.000 HBD"}, "transaction": {"id": "tx5"}},
            ],
        }
        result = await _provide_operations(ExchangeTransferProvider(), ops)

        assert len(result["exchange_transfer_operations"]) == 1
        assert result["exchange_transfer_operations"][0]["operation"]["amount"] == "100.000 HBD"
        assert result["exchange_transfer_operations"][0]["operation"]["exchange"] == "Upbit"

    @pytest.mark.asyncio
    async def test_no_transfers_returns_empty(self) -> None:
        result = await _provide_operations(ExchangeTransferProvider(), {})

        assert result == {"exchange_transfer_operations": []}


# ---------------------------------------------------------------------------
# WhaleAlertProvider
# ---------------------------------------------------------------------------


class TestWhaleAlertProvider:
    @pytest.mark.asyncio
    async def test_reports_transfer_above_threshold(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "whale", "to": "user", "amount": _asset(2000)}, "transaction": {"id": "tx1"}},
            ],
        }
        result = await _provide_operations(WhaleAlertProvider(), ops, {"assets": [_asset(1000)]})

        assert result["whale_operations"] == [
            {
                "operation": {"from": "whale", "to": "user", "amount": _asset(2000)},
                "transaction": {"id": "tx1"},
            }
        ]

    @pytest.mark.asyncio
    async def test_rejects_transfer_below_threshold(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "small", "to": "user", "amount": _asset(100)}, "transaction": {"id": "tx1"}},
            ],
        }
        result = await _provide_operations(WhaleAlertProvider(), ops, {"assets": [_asset(1000)]})

        assert result == {"whale_operations": []}

    @pytest.mark.asyncio
    async def test_rejects_transfer_with_different_asset(self) -> None:
        ops = {
            "transfer_operation": [
                {"operation": {"from": "whale", "to": "user", "amount": _asset(2000, "@@000000013")}, "transaction": {"id": "tx1"}},
            ],
        }
        result = await _provide_operations(WhaleAlertProvider(), ops, {"assets": [_asset(1000)]})

        assert result == {"whale_operations": []}

    @pytest.mark.asyncio
    async def test_reports_recurrent_transfer_above_threshold(self) -> None:
        ops = {
            "recurrent_transfer_operation": [
                {"operation": {"from": "whale", "to": "user", "amount": _asset(5000)}, "transaction": {"id": "tx2"}},
            ],
        }
        result = await _provide_operations(WhaleAlertProvider(), ops, {"assets": [_asset(1000)]})

        assert result["whale_operations"][0]["transaction"] == {"id": "tx2"}
        assert result["whale_operations"][0]["operation"]["amount"] == _asset(5000)


# ---------------------------------------------------------------------------
# InternalMarketProvider
# ---------------------------------------------------------------------------


class TestInternalMarketProvider:
    @pytest.mark.asyncio
    async def test_reports_limit_order_create(self) -> None:
        ops = {
            "limit_order_create_operation": [
                {
                    "operation": {
                        "owner": "alice",
                        "amount_to_sell": _asset(100),
                        "min_to_receive": _asset(50, "@@000000013"),
                        "expiration": "2026-12-31T00:00:00",
                        "orderid": 1,
                        "fill_or_kill": False,
                    },
                    "transaction": {"id": "tx1"},
                },
            ],
        }
        result = await _provide_operations(InternalMarketProvider(), ops)
        market_operation = result["internal_market_operations"][0]

        assert market_operation == {
            "operation": {
                "cancel": False,
                "owner": "alice",
                "order_id": 1,
                "amount_to_sell": _asset(100),
                "filled": False,
                "exchange_rate": {
                    "base": _asset(100),
                    "quote": _asset(50, "@@000000013"),
                },
                "expiration": datetime(2026, 12, 31, tzinfo=UTC),
            },
            "transaction": {"id": "tx1"},
        }

    @pytest.mark.asyncio
    async def test_reports_limit_order_create2(self) -> None:
        ops = {
            "limit_order_create2_operation": [
                {
                    "operation": {
                        "owner": "alice",
                        "amount_to_sell": _asset(100),
                        "exchange_rate": {
                            "base": _asset(100),
                            "quote": _asset(50, "@@000000013"),
                        },
                        "expiration": "2026-12-31T00:00:00",
                        "orderid": 2,
                        "fill_or_kill": True,
                    },
                    "transaction": {"id": "tx-create2"},
                },
            ],
        }
        result = await _provide_operations(InternalMarketProvider(), ops)

        assert result["internal_market_operations"] == [
            {
                "operation": {
                    "cancel": False,
                    "owner": "alice",
                    "order_id": 2,
                    "amount_to_sell": _asset(100),
                    "filled": True,
                    "exchange_rate": {
                        "base": _asset(100),
                        "quote": _asset(50, "@@000000013"),
                    },
                    "expiration": datetime(2026, 12, 31, tzinfo=UTC),
                },
                "transaction": {"id": "tx-create2"},
            }
        ]

    @pytest.mark.asyncio
    async def test_empty_operations_return_empty_payload(self) -> None:
        result = await _provide_operations(InternalMarketProvider(), {})

        assert result == {"internal_market_operations": []}


# ---------------------------------------------------------------------------
# CustomOperationProvider
# ---------------------------------------------------------------------------


class TestCustomOperationProvider:
    @pytest.mark.asyncio
    async def test_groups_by_custom_json_id(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(json_id="follow", posting_auth="alice", tx_id="tx1"),
                _custom_json_op(json_id="follow", posting_auth="bob", tx_id="tx2"),
            ],
        }
        result = await _provide_operations(CustomOperationProvider(), ops, {"ids": ["follow"]})

        assert "custom_operations" in result
        assert "follow" in result["custom_operations"]
        assert len(result["custom_operations"]["follow"]) == 2

    @pytest.mark.asyncio
    async def test_filters_by_registered_ids(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(json_id="follow", posting_auth="alice", tx_id="tx1"),
                _custom_json_op(json_id="reblog", posting_auth="alice", tx_id="tx2"),
            ],
        }
        result = await _provide_operations(CustomOperationProvider(), ops, {"ids": ["follow"]})

        assert "follow" in result["custom_operations"]
        assert "reblog" not in result["custom_operations"]

    @pytest.mark.asyncio
    async def test_no_custom_ops_returns_empty(self) -> None:
        result = await _provide_operations(CustomOperationProvider(), {}, {"ids": ["follow"]})

        assert result == {"custom_operations": {}}

    @pytest.mark.asyncio
    async def test_multiple_push_options_accumulates_ids(self) -> None:
        provider = CustomOperationProvider()
        provider.push_options({"ids": ["follow"]})
        provider.push_options({"ids": ["reblog"]})
        assert provider.ids == {"follow", "reblog"}


# ---------------------------------------------------------------------------
# Legacy custom_json providers
# ---------------------------------------------------------------------------


class TestLegacyCustomJsonProviders:
    @pytest.mark.asyncio
    async def test_follow_provider_groups_matching_follower(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(
                    json_id="follow",
                    json_payload='["follow", {"follower": "alice", "following": "bob", "what": ["blog"]}]',
                    tx_id="tx1",
                ),
            ],
        }

        result = await _provide_operations(FollowProvider(), ops, {"accounts": ["alice"]})

        assert result["follows"]["alice"][0]["operation"] == {
            "follower": "alice",
            "following": "bob",
            "what": ["blog"],
        }

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "operation",
        [
            pytest.param(
                _custom_json_op(
                    json_id="follow",
                    json_payload='["follow", {"follower": "bob", "following": "carol", "what": ["blog"]}]',
                ),
                id="untracked-follower",
            ),
            pytest.param(
                _custom_json_op(json_id="follow", json_payload="not valid json"),
                id="invalid-json",
            ),
            pytest.param(
                _custom_json_op(json_id="other", json_payload="[]"),
                id="other-custom-json-id",
            ),
            pytest.param(
                _custom_json_op(
                    json_id="follow",
                    json_payload='["reblog", {"account": "alice", "author": "bob", "permlink": "post"}]',
                ),
                id="reblog-payload",
            ),
        ],
    )
    async def test_follow_provider_rejects_unrelated_custom_json(self, operation: dict[str, Any]) -> None:
        result = await _provide_operations(FollowProvider(), {"custom_json_operation": [operation]}, {"accounts": ["alice"]})

        assert result == {"follows": {}}

    @pytest.mark.asyncio
    async def test_follow_provider_skips_malformed_legacy_payloads(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(json_id="follow", json_payload='["follow", []]', tx_id="bad"),
                _custom_json_op(
                    json_id="follow",
                    json_payload='["follow", {"follower": "alice", "following": "bob", "what": ["blog"]}]',
                    tx_id="good",
                ),
            ],
        }

        result = await _provide_operations(FollowProvider(), ops, {"accounts": ["alice"]})

        assert [entry["operation"]["following"] for entry in result["follows"]["alice"]] == ["bob"]

    @pytest.mark.asyncio
    async def test_reblog_provider_groups_matching_account(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(
                    json_id="follow",
                    json_payload='["reblog", {"account": "alice", "author": "bob", "permlink": "post"}]',
                    tx_id="tx2",
                ),
            ],
        }

        result = await _provide_operations(ReblogProvider(), ops, {"accounts": ["alice"]})

        assert result["reblogs"]["alice"][0]["operation"] == {
            "account": "alice",
            "author": "bob",
            "permlink": "post",
        }

    @pytest.mark.asyncio
    async def test_reblog_provider_rejects_follow_payload(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(
                    json_id="follow",
                    json_payload='["follow", {"follower": "alice", "following": "bob", "what": ["blog"]}]',
                ),
            ],
        }

        result = await _provide_operations(ReblogProvider(), ops, {"accounts": ["alice"]})

        assert result == {"reblogs": {}}

    @pytest.mark.asyncio
    async def test_reblog_provider_skips_malformed_legacy_payloads(self) -> None:
        ops = {
            "custom_json_operation": [
                _custom_json_op(json_id="follow", json_payload='["reblog", []]', tx_id="bad"),
                _custom_json_op(
                    json_id="follow",
                    json_payload='["reblog", {"account": "alice", "author": "bob", "permlink": "post"}]',
                    tx_id="good",
                ),
            ],
        }

        result = await _provide_operations(ReblogProvider(), ops, {"accounts": ["alice"]})

        assert [entry["operation"]["permlink"] for entry in result["reblogs"]["alice"]] == ["post"]
