"""Tests for collector classes.

Tests verify that collectors correctly transform data from parent classifiers
into the expected output format keyed by their classifier's __name__.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, cast

import pytest

from workerbee.chain_observers.classifiers.block_classifier import BlockClassifier
from workerbee.chain_observers.classifiers.block_header_classifier import BlockHeaderClassifier
from workerbee.chain_observers.classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from workerbee.chain_observers.classifiers.operation_classifier import OperationClassifier
from workerbee.chain_observers.collectors.collector_base import CollectorBase
from workerbee.chain_observers.collectors.common.block_header_collector import BlockHeaderCollector
from workerbee.chain_observers.collectors.common.operation_collector import OperationCollector
from workerbee.chain_observers.collectors.jsonrpc.block_collector import BlockCollector
from workerbee.chain_observers.factories.data_evaluation_context import DataEvaluationContext

from .conftest import make_data_context, make_operation

if TYPE_CHECKING:
    from workerbee.chain_observers.factories.data_evaluation_context import TCollectorEvaluationContext
    from workerbee.chain_observers.interfaces import IWorkerBee

type BlockTransaction = dict[str, object]


@pytest.fixture()
def block_context() -> Callable[[list[BlockTransaction]], DataEvaluationContext]:
    def build(transactions: list[BlockTransaction]) -> DataEvaluationContext:
        block_data = {
            BlockClassifier.__name__: {
                "transactions": transactions,
                "transactions_per_id": {str(tx["id"]): tx["transaction"] for tx in transactions},
            },
        }
        return make_data_context((BlockClassifier, block_data))

    return build


# ---------------------------------------------------------------------------
# Helpers — lightweight stubs
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# BlockHeaderCollector
# ---------------------------------------------------------------------------


class TestBlockHeaderCollector:
    @pytest.mark.asyncio
    async def test_extracts_header_from_dgp(self) -> None:
        """BlockHeaderCollector reads DynamicGlobalPropertiesClassifier and produces BlockHeaderClassifier data."""
        dgp_data = {
            DynamicGlobalPropertiesClassifier.__name__: {
                "head_block_number": 42,
                "current_witness": "witness-x",
                "head_block_time": "2024-08-01T06:00:00",
                "head_block_id": "block-id-42",
                "downvote_pool_percent": 25,
            },
        }
        ctx = make_data_context((DynamicGlobalPropertiesClassifier, dgp_data))

        collector = BlockHeaderCollector(worker=None)
        # Inject the collector under test for BlockHeaderClassifier so DEC recognizes it
        ctx.inject(BlockHeaderClassifier, collector)

        result = await collector.get(ctx)

        assert BlockHeaderClassifier.__name__ in result
        header = result[BlockHeaderClassifier.__name__]
        assert header["number"] == 42
        assert header["witness"] == "witness-x"
        assert header["timestamp"] == "2024-08-01T06:00:00"
        assert header["id"] == "block-id-42"

    @pytest.mark.asyncio
    async def test_used_contexts(self) -> None:
        collector = BlockHeaderCollector(worker=None)
        contexts = collector.used_contexts()
        assert DynamicGlobalPropertiesClassifier in contexts


# ---------------------------------------------------------------------------
# OperationCollector
# ---------------------------------------------------------------------------


class TestOperationCollector:
    @pytest.mark.asyncio
    async def test_extracts_operations_and_groups_by_type(self, block_context: Callable[[list[BlockTransaction]], DataEvaluationContext]) -> None:
        transactions = [
            {
                "transaction": {
                    "operations": [
                        make_operation("vote_operation", {"voter": "alice", "author": "bob", "permlink": "p1", "weight": 10000}),
                        make_operation("transfer_operation", {"from": "alice", "to": "bob", "amount": "1.000 HIVE"}),
                    ],
                },
                "id": "tx1",
            },
            {
                "transaction": {
                    "operations": [
                        make_operation("vote_operation", {"voter": "carol", "author": "dave", "permlink": "p2", "weight": 5000}),
                    ],
                },
                "id": "tx2",
            },
        ]
        ctx = block_context(transactions)
        collector = OperationCollector(worker=None)

        result = await collector.get(ctx)

        assert OperationClassifier.__name__ in result
        op_data = result[OperationClassifier.__name__]

        # All operations collected
        assert len(op_data["operations"]) == 3

        # Operations grouped by type
        assert "vote_operation" in op_data["operations_per_type"]
        assert len(op_data["operations_per_type"]["vote_operation"]) == 2
        assert "transfer_operation" in op_data["operations_per_type"]
        assert len(op_data["operations_per_type"]["transfer_operation"]) == 1

    @pytest.mark.asyncio
    async def test_empty_transactions(self, block_context: Callable[[list[BlockTransaction]], DataEvaluationContext]) -> None:
        ctx = block_context([])
        collector = OperationCollector(worker=None)

        result = await collector.get(ctx)

        op_data = result[OperationClassifier.__name__]
        assert op_data["operations"] == []
        assert op_data["operations_per_type"] == {}

    @pytest.mark.asyncio
    async def test_operation_entry_has_operation_and_transaction(self, block_context: Callable[[list[BlockTransaction]], DataEvaluationContext]) -> None:
        """Each entry in operations_per_type should have 'operation' and 'transaction' keys."""
        transactions = [
            {
                "transaction": {
                    "operations": [
                        make_operation("vote_operation", {"voter": "alice", "author": "bob", "permlink": "p1", "weight": 10000}),
                    ],
                },
                "id": "tx1",
            },
        ]
        ctx = block_context(transactions)
        collector = OperationCollector(worker=None)

        result = await collector.get(ctx)
        op_data = result[OperationClassifier.__name__]

        vote_entry = op_data["operations_per_type"]["vote_operation"][0]
        assert "operation" in vote_entry
        assert "transaction" in vote_entry
        # operations_per_type stores the unwrapped op.value body (not the envelope)
        assert vote_entry["operation"]["voter"] == "alice"

    @pytest.mark.asyncio
    async def test_groups_by_hf26_op_type(self, block_context: Callable[[list[BlockTransaction]], DataEvaluationContext]) -> None:
        """Each hf26 operation is grouped by its op.type."""
        transactions = [
            {
                "transaction": {
                    "operations": [
                        make_operation("comment_operation", {"author": "alice", "body": "hi"}),
                    ],
                },
                "id": "tx1",
            },
        ]
        ctx = block_context(transactions)
        collector = OperationCollector(worker=None)

        result = await collector.get(ctx)
        op_data = result[OperationClassifier.__name__]

        assert "comment_operation" in op_data["operations_per_type"]
        assert len(op_data["operations_per_type"]["comment_operation"]) == 1

    @pytest.mark.asyncio
    async def test_used_contexts(self) -> None:
        collector = OperationCollector(worker=None)
        contexts = collector.used_contexts()
        assert BlockClassifier in contexts

    @pytest.mark.asyncio
    async def test_multiple_ops_same_type_same_tx(self, block_context: Callable[[list[BlockTransaction]], DataEvaluationContext]) -> None:
        """Multiple operations of the same type in the same transaction."""
        transactions = [
            {
                "transaction": {
                    "operations": [
                        make_operation("vote_operation", {"voter": "alice", "author": "bob", "permlink": "p1", "weight": 10000}),
                        make_operation("vote_operation", {"voter": "alice", "author": "carol", "permlink": "p2", "weight": 5000}),
                    ],
                },
                "id": "tx1",
            },
        ]
        ctx = block_context(transactions)
        collector = OperationCollector(worker=None)

        result = await collector.get(ctx)
        op_data = result[OperationClassifier.__name__]

        assert len(op_data["operations_per_type"]["vote_operation"]) == 2
        assert len(op_data["operations"]) == 2


# ---------------------------------------------------------------------------
# JSON-RPC BlockCollector
# ---------------------------------------------------------------------------


class _RecordingBlockApi:
    def __init__(self, *, range_limit: int | None = None) -> None:
        self.block_calls: list[int] = []
        self.range_calls: list[tuple[int, int]] = []
        self._range_limit = range_limit

    async def get_block(self, *, block_num: int) -> SimpleNamespace:
        self.block_calls.append(block_num)
        return SimpleNamespace(block=self._block(block_num))

    async def get_block_range(self, *, starting_block_num: int, count: int) -> SimpleNamespace:
        self.range_calls.append((starting_block_num, count))
        stop = starting_block_num + count
        if self._range_limit is not None:
            stop = min(stop, starting_block_num + self._range_limit)
        return SimpleNamespace(
            blocks=[self._block(number) for number in range(starting_block_num, stop)],
        )

    def _block(self, number: int) -> SimpleNamespace:
        return SimpleNamespace(
            transactions=[{"height": number}],
            transaction_ids=[f"tx-{number}"],
        )


class _BlockCollectorWorker:
    def __init__(self, block_api: _RecordingBlockApi) -> None:
        self.chain = SimpleNamespace(api=SimpleNamespace(block_api=block_api))


class _HeadContext:
    def __init__(self, heads: list[int]) -> None:
        self._heads = iter(heads)

    async def get(self, classifier: type[DynamicGlobalPropertiesClassifier]) -> dict[str, int]:
        assert classifier is DynamicGlobalPropertiesClassifier
        return {"head_block_number": next(self._heads)}

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        yield

    async def query(self, classifier: object, data: object | None = None) -> object:
        raise AssertionError("BlockCollector.get must not call query")


class TestJsonRpcBlockCollector:
    @pytest.mark.asyncio
    async def test_catch_up_finishes_at_advertised_head(self) -> None:
        """Catch-up must finish on head, not one block behind after a multi-block gap."""
        block_api = _RecordingBlockApi()
        worker = _BlockCollectorWorker(block_api)
        collector = BlockCollector(cast("IWorkerBee", worker))
        ctx = cast("TCollectorEvaluationContext", _HeadContext([10, 12]))

        first = await collector.get(ctx)
        second = await collector.get(ctx)

        assert [tx["id"] for tx in first[BlockClassifier.__name__]["transactions"]] == ["tx-10"]
        assert block_api.block_calls == [10]
        assert block_api.range_calls == [(11, 2)]

        block_data = second[BlockClassifier.__name__]
        assert [tx["id"] for tx in block_data["transactions"]] == ["tx-11", "tx-12"]
        assert block_data["transactions_per_id"] == {
            "tx-11": {"height": 11},
            "tx-12": {"height": 12},
        }
        assert collector._current_head_block == 12

    @pytest.mark.asyncio
    async def test_partial_range_response_advances_only_to_last_fetched_block(self) -> None:
        block_api = _RecordingBlockApi(range_limit=1)
        worker = _BlockCollectorWorker(block_api)
        collector = BlockCollector(cast("IWorkerBee", worker))
        ctx = cast("TCollectorEvaluationContext", _HeadContext([10, 12, 12]))

        await collector.get(ctx)
        partial = await collector.get(ctx)
        assert collector._current_head_block == 11

        recovered = await collector.get(ctx)

        assert [tx["id"] for tx in partial[BlockClassifier.__name__]["transactions"]] == ["tx-11"]
        assert collector._current_head_block == 12
        assert [tx["id"] for tx in recovered[BlockClassifier.__name__]["transactions"]] == ["tx-12"]
        assert block_api.block_calls == [10, 12]
        assert block_api.range_calls == [(11, 2)]


# ---------------------------------------------------------------------------
# CollectorBase
# ---------------------------------------------------------------------------


class TestCollectorBase:
    def test_register_increments_count(self) -> None:
        collector = CollectorBase(worker=None)
        assert collector._registers_count == 0
        assert collector.has_registered is False

        collector.register()
        assert collector._registers_count == 1
        assert collector.has_registered is True

    def test_unregister_decrements_count(self) -> None:
        collector = CollectorBase(worker=None)
        collector.register()
        collector.register()
        assert collector._registers_count == 2

        collector.unregister()
        assert collector._registers_count == 1
        assert collector.has_registered is True

        collector.unregister()
        assert collector._registers_count == 0
        assert collector.has_registered is False

    def test_register_with_data_calls_push_options(self) -> None:
        pushed: list[Any] = []

        class _TrackingCollector(CollectorBase):
            def push_options(self, data: Any) -> None:
                pushed.append(data)

        collector = _TrackingCollector(worker=None)
        collector.register({"key": "value"})

        assert len(pushed) == 1
        assert pushed[0] == {"key": "value"}

    def test_unregister_with_data_calls_pop_options(self) -> None:
        popped: list[Any] = []

        class _TrackingCollector(CollectorBase):
            def pop_options(self, data: Any) -> None:
                popped.append(data)

        collector = _TrackingCollector(worker=None)
        collector.register()
        collector.unregister({"key": "value"})

        assert len(popped) == 1
        assert popped[0] == {"key": "value"}

    @pytest.mark.asyncio
    async def test_get_raises_not_implemented(self) -> None:
        collector = CollectorBase(worker=None)
        with pytest.raises(NotImplementedError, match="does not implement"):
            await collector.get(None)

    @pytest.mark.asyncio
    async def test_query_raises_not_implemented(self) -> None:
        collector = CollectorBase(worker=None)
        with pytest.raises(NotImplementedError, match="does not implement"):
            await collector.query(None, None)

    def test_used_contexts_returns_empty_list(self) -> None:
        collector = CollectorBase(worker=None)
        assert collector.used_contexts() == []
