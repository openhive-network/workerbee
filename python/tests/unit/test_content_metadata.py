"""Tests for ContentMetadataCollector, ContentMetadataProvider, and BucketAggregateQueue."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import pytest

from workerbee.chain_observers.classifiers.content_metadata_classifier import ContentMetadataClassifier
from workerbee.chain_observers.classifiers.operation_classifier import OperationClassifier
from workerbee.chain_observers.collectors.bucket_aggregate_queue import BucketAggregateQueue
from workerbee.chain_observers.collectors.jsonrpc.content_metadata_collector import (
    ContentMetadataCollector,
)
from workerbee.chain_observers.filters.content_metadata_filter import CommentMetadataFilter, PostMetadataFilter
from workerbee.chain_observers.payloads import OperationsPerType
from workerbee.chain_observers.providers.content_metadata_provider import (
    CommentMetadataProvider,
    PostMetadataProvider,
)

# ═══════════════════════════════════════════════════════════════════
# Fakes
# ═══════════════════════════════════════════════════════════════════


class FakeCashoutInfo:
    def __init__(
        self,
        author: str = "alice",
        permlink: str = "my-post",
        cashout_time: str = "2026-07-01T00:00:00",
        net_rshares: int = 100000,
        net_votes: int = 10,
        allow_curation_rewards: bool = True,
        allow_replies: bool = True,
        allow_votes: bool = True,
        author_rewards: int = 0,
        total_payout_value: str = "0.000 HBD",
        curator_payout_value: str = "0.000 HBD",
        has_cashout: bool = True,
    ) -> None:
        self.author = author
        self.permlink = permlink
        if has_cashout:
            self.cashout_info = _FakeCashout(
                cashout_time,
                net_rshares,
                net_votes,
                allow_curation_rewards,
                allow_replies,
                allow_votes,
                author_rewards,
                total_payout_value,
                curator_payout_value,
            )
        else:
            self.cashout_info = None


class _FakeCashout:
    def __init__(
        self,
        cashout_time: str,
        net_rshares: int,
        net_votes: int,
        allow_curation_rewards: bool,
        allow_replies: bool,
        allow_votes: bool,
        author_rewards: int,
        total_payout_value: str,
        curator_payout_value: str,
    ) -> None:
        self.cashout_time = cashout_time
        self.net_rshares = net_rshares
        self.net_votes = net_votes
        self.allow_curation_rewards = allow_curation_rewards
        self.allow_replies = allow_replies
        self.allow_votes = allow_votes
        self.author_rewards = author_rewards
        self.total_payout_value = total_payout_value
        self.curator_payout_value = curator_payout_value


class FakeApiResponse:
    def __init__(self, cashout_infos: list[FakeCashoutInfo]) -> None:
        self.cashout_infos = cashout_infos


class FakeDatabaseApi:
    def __init__(self, cashout_infos: list[FakeCashoutInfo] | None = None) -> None:
        self._cashout_infos = cashout_infos or []
        self.call_count = 0
        self.last_comments_arg: list[list[str]] | None = None

    async def get_comment_pending_payouts(self, comments: list[list[str]]) -> FakeApiResponse:
        self.call_count += 1
        self.last_comments_arg = comments
        return FakeApiResponse(self._cashout_infos)


class FakeApi:
    def __init__(self, database_api: FakeDatabaseApi) -> None:
        self.database_api = database_api


class FakeChain:
    def __init__(self, database_api: FakeDatabaseApi) -> None:
        self.api = FakeApi(database_api)


class FakeWorker:
    def __init__(self, database_api: FakeDatabaseApi) -> None:
        self.chain = FakeChain(database_api)


class FakeDataContext:
    def __init__(self) -> None:
        self.timings: dict[str, float] = {}

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        try:
            yield
        finally:
            self.timings[name] = self.timings.get(name, 0)

    async def get(self, classifier: type) -> dict[str, object]:
        return {"content_data": {}}

    async def query(self, classifier: type, options: object) -> object:
        return {}


class FakeDataContextWithContent:
    def __init__(self, content_data: dict[str, dict[str, dict[str, object]]]) -> None:
        self._content_data = content_data
        self.timings: dict[str, float] = {}

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        try:
            yield
        finally:
            self.timings[name] = self.timings.get(name, 0)

    async def get(self, classifier: type) -> dict[str, object]:
        return {"content_data": self._content_data}

    async def query(self, classifier: type, options: object) -> object:
        return {}


class FakeContentMetadataFilterContext:
    def __init__(
        self,
        content_data: dict[str, dict[str, dict[str, object]]],
        operations_per_type: OperationsPerType | None = None,
        query_result: dict[str, dict[str, dict[str, object]]] | None = None,
    ) -> None:
        self._content_data = content_data
        self._operations_per_type = operations_per_type or {}
        self._query_result = query_result or {}

    async def get(self, classifier: type) -> dict[str, object]:
        if classifier is OperationClassifier:
            return {"operations_per_type": self._operations_per_type}
        if classifier is ContentMetadataClassifier:
            return {"content_data": self._content_data}
        raise AssertionError(f"Unexpected classifier: {classifier!r}")

    async def query(self, classifier: type, options: object) -> object:
        return self._query_result


# ═══════════════════════════════════════════════════════════════════
# BucketAggregateQueue tests
# ═══════════════════════════════════════════════════════════════════


class TestBucketAggregateQueue:
    def test_enqueue_and_size(self) -> None:
        q: BucketAggregateQueue[str] = BucketAggregateQueue(100)
        q.enqueue(50, "a")
        q.enqueue(150, "b")
        q.enqueue(250, "c")
        assert q.size == 3

    def test_dequeue_until_returns_items_up_to_max(self) -> None:
        q: BucketAggregateQueue[str] = BucketAggregateQueue(100)
        q.enqueue(50, "a")  # bucket 0
        q.enqueue(150, "b")  # bucket 100
        q.enqueue(250, "c")  # bucket 200
        # dequeue_until(200) includes bucket 200 (200 <= 200)
        items = list(q.dequeue_until(200))
        assert items == ["a", "b", "c"]
        assert q.size == 0

    def test_dequeue_until_empty_queue(self) -> None:
        q: BucketAggregateQueue[str] = BucketAggregateQueue(100)
        items = list(q.dequeue_until(1000))
        assert items == []

    def test_dequeue_until_no_matching(self) -> None:
        q: BucketAggregateQueue[str] = BucketAggregateQueue(100)
        q.enqueue(500, "a")
        items = list(q.dequeue_until(100))
        assert items == []
        assert q.size == 1

    def test_same_bucket_multiple_items(self) -> None:
        q: BucketAggregateQueue[str] = BucketAggregateQueue(100)
        q.enqueue(105, "a")
        q.enqueue(110, "b")
        q.enqueue(190, "c")
        items = list(q.dequeue_until(200))
        assert items == ["a", "b", "c"]
        assert q.size == 0

    def test_constructor_validation(self) -> None:
        with pytest.raises(ValueError, match="positive"):
            BucketAggregateQueue(0)
        with pytest.raises(ValueError, match="positive"):
            BucketAggregateQueue(-1)

    def test_dequeue_removes_only_qualifying_buckets(self) -> None:
        q: BucketAggregateQueue[int] = BucketAggregateQueue(1000)
        q.enqueue(500, 1)  # bucket 0
        q.enqueue(1500, 2)  # bucket 1000
        q.enqueue(2500, 3)  # bucket 2000

        # dequeue_until(999) only includes bucket 0 (0 <= 999, 1000 > 999)
        items = list(q.dequeue_until(999))
        assert items == [1]
        assert q.size == 2

        # dequeue_until(1999) includes bucket 1000 (1000 <= 1999, 2000 > 1999)
        items = list(q.dequeue_until(1999))
        assert items == [2]
        assert q.size == 1

    def test_bucket_key_calculation(self) -> None:
        q: BucketAggregateQueue[str] = BucketAggregateQueue(3000)
        q.enqueue(3001, "a")
        q.enqueue(5999, "b")
        # Both are in bucket 3000 (floor(3001/3000)*3000 = 3000, floor(5999/3000)*3000 = 3000)
        items = list(q.dequeue_until(3000))
        assert items == ["a", "b"]


# ═══════════════════════════════════════════════════════════════════
# ContentMetadataCollector tests
# ═══════════════════════════════════════════════════════════════════


class TestContentMetadataCollectorGet:
    @pytest.mark.asyncio
    async def test_get_empty_queue_returns_empty_content(self) -> None:
        db_api = FakeDatabaseApi()
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        result = await collector.get(ctx)
        assert "ContentMetadataClassifier" in result
        assert result["ContentMetadataClassifier"]["content_data"] == {}
        assert db_api.call_count == 0

    @pytest.mark.asyncio
    async def test_get_processes_queued_items(self) -> None:
        cashout = FakeCashoutInfo(author="alice", permlink="my-post")
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        # Manually enqueue an item with a past timestamp
        collector._contract_timestamps.enqueue(
            0,
            {
                "author": "alice",
                "permlink": "my-post",
                "parent_author": "",
                "parent_permlink": "hive-1234",
                "title": "My Post",
            },
        )
        collector._content_cached.add("alice/my-post")

        result = await collector.get(ctx)
        content = result["ContentMetadataClassifier"]["content_data"]
        assert "alice" in content
        assert "my-post" in content["alice"]
        assert content["alice"]["my-post"]["author"] == "alice"
        assert db_api.call_count == 1
        # Cache should be cleaned up
        assert "alice/my-post" not in collector._content_cached


class TestContentMetadataCollectorQuery:
    @pytest.mark.asyncio
    async def test_query_returns_content_data(self) -> None:
        cashout = FakeCashoutInfo(
            author="bob",
            permlink="hello-world",
            net_rshares=500000,
            net_votes=25,
        )
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        options = {
            "requested_data": [
                {
                    "author": "bob",
                    "permlink": "hello-world",
                    "parent_author": "",
                    "parent_permlink": "hive-123",
                    "title": "Hello World",
                }
            ],
        }

        result = await collector.query(ctx, options)
        assert "bob" in result
        assert "hello-world" in result["bob"]
        metadata = result["bob"]["hello-world"]
        assert metadata["author"] == "bob"
        assert metadata["permlink"] == "hello-world"
        assert metadata["net_rshares"] == 500000
        assert metadata["net_votes"] == 25
        assert metadata["is_paid"] is False

    @pytest.mark.asyncio
    async def test_query_with_report_after_ms_enqueues_items(self) -> None:
        future_time = "2099-01-01T00:00:00"
        cashout = FakeCashoutInfo(
            author="alice",
            permlink="future-post",
            cashout_time=future_time,
        )
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        options = {
            "requested_data": [
                {
                    "author": "alice",
                    "permlink": "future-post",
                    "parent_author": "",
                    "parent_permlink": "category",
                    "title": "Future Post",
                }
            ],
            "report_after_ms_before_payout": 6000,
        }

        await collector.query(ctx, options)
        assert "alice/future-post" in collector._content_cached
        assert collector._contract_timestamps.size == 1

    @pytest.mark.asyncio
    async def test_query_paid_posts_not_enqueued(self) -> None:
        cashout = FakeCashoutInfo(
            author="alice",
            permlink="paid-post",
            has_cashout=False,
        )
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        options = {
            "requested_data": [
                {
                    "author": "alice",
                    "permlink": "paid-post",
                    "parent_author": "",
                    "parent_permlink": "category",
                    "title": "Paid",
                }
            ],
            "report_after_ms_before_payout": 6000,
        }

        result = await collector.query(ctx, options)
        assert result["alice"]["paid-post"]["is_paid"] is True
        assert collector._contract_timestamps.size == 0

    @pytest.mark.asyncio
    async def test_query_no_report_after_ms_skips_enqueue(self) -> None:
        cashout = FakeCashoutInfo(author="alice", permlink="p1")
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        options = {
            "requested_data": [
                {
                    "author": "alice",
                    "permlink": "p1",
                    "parent_author": "",
                    "parent_permlink": "cat",
                    "title": "Title",
                }
            ],
        }

        await collector.query(ctx, options)
        assert collector._contract_timestamps.size == 0

    @pytest.mark.asyncio
    async def test_query_missing_comment_raises(self) -> None:
        cashout = FakeCashoutInfo(author="unknown", permlink="missing")
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        options = {
            "requested_data": [
                {
                    "author": "alice",
                    "permlink": "other",
                    "parent_author": "",
                    "parent_permlink": "cat",
                    "title": "Title",
                }
            ],
        }

        with pytest.raises(RuntimeError, match="not found in operations"):
            await collector.query(ctx, options)

    @pytest.mark.asyncio
    async def test_query_duplicate_not_enqueued_twice(self) -> None:
        cashout = FakeCashoutInfo(author="alice", permlink="post1", cashout_time="2099-01-01T00:00:00")
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        options = {
            "requested_data": [
                {
                    "author": "alice",
                    "permlink": "post1",
                    "parent_author": "",
                    "parent_permlink": "cat",
                    "title": "Title",
                }
            ],
            "report_after_ms_before_payout": 6000,
        }

        await collector.query(ctx, options)
        await collector.query(ctx, options)
        assert collector._contract_timestamps.size == 1


class TestContentMetadataCollectorResultShape:
    @pytest.mark.asyncio
    async def test_cashout_metadata_shape(self) -> None:
        cashout = FakeCashoutInfo(
            author="alice",
            permlink="post1",
            net_rshares=12345,
            net_votes=5,
            author_rewards=100,
            allow_curation_rewards=True,
            allow_replies=True,
            allow_votes=False,
        )
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        result = await collector.query(
            ctx,
            {
                "requested_data": [
                    {
                        "author": "alice",
                        "permlink": "post1",
                        "parent_author": "",
                        "parent_permlink": "category",
                        "title": "My Title",
                    }
                ],
            },
        )

        metadata = result["alice"]["post1"]
        assert metadata["author"] == "alice"
        assert metadata["permlink"] == "post1"
        assert metadata["parent_author"] == ""
        assert metadata["parent_permlink"] == "category"
        assert metadata["category"] == "category"
        assert metadata["title"] == "My Title"
        assert metadata["net_rshares"] == 12345
        assert metadata["net_votes"] == 5
        assert metadata["author_rewards"] == 100
        assert metadata["allows_curation_rewards"] is True
        assert metadata["allows_replies"] is True
        assert metadata["allows_votes"] is False
        assert metadata["is_paid"] is False

    @pytest.mark.asyncio
    async def test_paid_metadata_shape(self) -> None:
        cashout = FakeCashoutInfo(
            author="bob",
            permlink="old-post",
            has_cashout=False,
        )
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        result = await collector.query(
            ctx,
            {
                "requested_data": [
                    {
                        "author": "bob",
                        "permlink": "old-post",
                        "parent_author": "alice",
                        "parent_permlink": "parent-post",
                        "title": "Reply",
                    }
                ],
            },
        )

        metadata = result["bob"]["old-post"]
        assert metadata["is_paid"] is True
        assert metadata["net_rshares"] == 0
        assert metadata["net_votes"] == 0
        assert metadata["author_rewards"] == 0
        assert metadata["allows_curation_rewards"] is False
        assert metadata["allows_replies"] is True
        assert metadata["allows_votes"] is True
        assert metadata["parent_author"] == "alice"
        assert metadata["category"] == ""

    @pytest.mark.asyncio
    async def test_category_is_parent_permlink_for_posts(self) -> None:
        cashout = FakeCashoutInfo(author="alice", permlink="p1")
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        result = await collector.query(
            ctx,
            {
                "requested_data": [
                    {
                        "author": "alice",
                        "permlink": "p1",
                        "parent_author": "",
                        "parent_permlink": "hive-123456",
                        "title": "Post",
                    }
                ],
            },
        )

        assert result["alice"]["p1"]["category"] == "hive-123456"

    @pytest.mark.asyncio
    async def test_category_is_empty_for_comments(self) -> None:
        cashout = FakeCashoutInfo(author="alice", permlink="reply1")
        db_api = FakeDatabaseApi(cashout_infos=[cashout])
        worker = FakeWorker(db_api)
        collector = ContentMetadataCollector(worker)
        ctx = FakeDataContext()

        result = await collector.query(
            ctx,
            {
                "requested_data": [
                    {
                        "author": "alice",
                        "permlink": "reply1",
                        "parent_author": "bob",
                        "parent_permlink": "original-post",
                        "title": "",
                    }
                ],
            },
        )

        assert result["alice"]["reply1"]["category"] == ""


# ═══════════════════════════════════════════════════════════════════
# ContentMetadataFilter tests
# ═══════════════════════════════════════════════════════════════════


class TestContentMetadataFilter:
    @pytest.mark.asyncio
    async def test_post_filter_matches_any_content_metadata_like_typescript(self) -> None:
        ctx = FakeContentMetadataFilterContext(
            {
                "bob": {
                    "post": {"parent_author": "", "title": "Bob post"},
                },
            },
        )
        filt = PostMetadataFilter(report_after_ms_before_payout=0, accounts=["alice"])

        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_post_filter_matches_comment_metadata_like_typescript(self) -> None:
        ctx = FakeContentMetadataFilterContext(
            {
                "alice": {
                    "reply": {"parent_author": "bob", "title": "Alice reply"},
                },
            },
        )
        filt = PostMetadataFilter(report_after_ms_before_payout=0, accounts=["alice"])

        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_post_filter_matches_unrequested_permlink_like_typescript(self) -> None:
        requested_operation = {
            "author": "alice",
            "permlink": "requested",
            "parent_author": "",
            "parent_permlink": "category",
            "title": "Requested post",
        }
        ctx = FakeContentMetadataFilterContext(
            {
                "alice": {
                    "other": {"parent_author": "", "title": "Other post"},
                },
            },
            operations_per_type={"comment_operation": [{"operation": requested_operation}]},
            query_result={
                "alice": {
                    "requested": {"parent_author": "", "title": "Requested post", "is_paid": False},
                },
            },
        )
        filt = PostMetadataFilter(report_after_ms_before_payout=0, accounts=["alice"])

        assert await filt.match(ctx) is True

    @pytest.mark.asyncio
    async def test_comment_filter_matches_comment_metadata_for_requested_author(self) -> None:
        requested_operation = {
            "author": "alice",
            "permlink": "reply",
            "parent_author": "bob",
            "parent_permlink": "post",
            "title": "Alice reply",
        }
        ctx = FakeContentMetadataFilterContext(
            {
                "alice": {
                    "reply": {"parent_author": "bob", "title": "Alice reply"},
                },
            },
            operations_per_type={"comment_operation": [{"operation": requested_operation}]},
            query_result={
                "alice": {
                    "reply": {"parent_author": "bob", "title": "Alice reply", "is_paid": False},
                },
            },
        )
        filt = CommentMetadataFilter(report_after_ms_before_payout=0, accounts=["alice"])

        assert await filt.match(ctx) is True


# ═══════════════════════════════════════════════════════════════════
# ContentMetadataProvider tests
# ═══════════════════════════════════════════════════════════════════


class TestPostMetadataProvider:
    def test_pushOptions_adds_authors(self) -> None:
        provider = PostMetadataProvider()
        provider.push_options({"authors": ["alice", "bob"]})
        assert provider.authors == {"alice", "bob"}

    def test_pushOptions_accumulates(self) -> None:
        provider = PostMetadataProvider()
        provider.push_options({"authors": ["alice"]})
        provider.push_options({"authors": ["bob"]})
        assert provider.authors == {"alice", "bob"}

    def test_pushOptions_empty_raises(self) -> None:
        provider = PostMetadataProvider()
        with pytest.raises(ValueError, match="authors must not be empty"):
            provider.push_options({"authors": []})

    @pytest.mark.asyncio
    async def test_provide_filters_posts_only(self) -> None:
        content_data = {
            "alice": {
                "my-post": {"parent_author": "", "title": "Post"},
                "my-reply": {"parent_author": "bob", "title": "Reply"},
            },
        }
        ctx = FakeDataContextWithContent(content_data)
        provider = PostMetadataProvider()
        provider.push_options({"authors": ["alice"]})

        result = await provider.provide(ctx)
        assert "posts_metadata" in result
        posts = result["posts_metadata"]
        assert "alice" in posts
        assert "my-post" in posts["alice"]
        assert "my-reply" not in posts["alice"]

    @pytest.mark.asyncio
    async def test_provide_empty_when_no_matching_authors(self) -> None:
        content_data = {
            "bob": {"post1": {"parent_author": "", "title": "Bob's Post"}},
        }
        ctx = FakeDataContextWithContent(content_data)
        provider = PostMetadataProvider()
        provider.push_options({"authors": ["alice"]})

        result = await provider.provide(ctx)
        assert result["posts_metadata"] == {}

    def test_usedContexts(self) -> None:
        provider = PostMetadataProvider()
        contexts = provider.used_contexts()
        assert ContentMetadataClassifier in contexts


class TestCommentMetadataProvider:
    def test_pushOptions_adds_authors(self) -> None:
        provider = CommentMetadataProvider()
        provider.push_options({"authors": ["alice"]})
        assert provider.authors == {"alice"}

    def test_pushOptions_empty_raises(self) -> None:
        provider = CommentMetadataProvider()
        with pytest.raises(ValueError, match="authors must not be empty"):
            provider.push_options({"authors": []})

    @pytest.mark.asyncio
    async def test_provide_filters_comments_only(self) -> None:
        content_data = {
            "alice": {
                "my-post": {"parent_author": "", "title": "Post"},
                "my-reply": {"parent_author": "bob", "title": "Reply"},
            },
        }
        ctx = FakeDataContextWithContent(content_data)
        provider = CommentMetadataProvider()
        provider.push_options({"authors": ["alice"]})

        result = await provider.provide(ctx)
        assert "comments_metadata" in result
        comments = result["comments_metadata"]
        assert "alice" in comments
        assert "my-reply" in comments["alice"]
        assert "my-post" not in comments["alice"]

    @pytest.mark.asyncio
    async def test_provide_empty_content(self) -> None:
        ctx = FakeDataContextWithContent({})
        provider = CommentMetadataProvider()
        provider.push_options({"authors": ["alice"]})

        result = await provider.provide(ctx)
        assert result["comments_metadata"] == {}
