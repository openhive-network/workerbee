"""Shared pytest fixtures for WorkerBee tests.

Provides fake chain objects and synthetic block builders so tests never
make real network calls.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, cast

import pytest
from hiveio_api import HiveDateTime
from hiveio_api.block_api import Block, GetBlockRangeResponse, GetBlockResponse
from hiveio_api.database_api import GetFeedHistoryResponse
from hiveio_api.operations import Hf26Operation, Transaction

from workerbee.chain_observers.collectors.collector_base import CollectorBase
from workerbee.chain_observers.factories.data_evaluation_context import DataEvaluationContext
from workerbee.chain_observers.factories.factory_base import FactoryBase

from ._builders import (
    build_account,
    build_block,
    build_price,
    build_rc_account,
    build_witness,
    find_accounts_response,
    find_rc_accounts_response,
    find_witnesses_response,
    get_block_range_response,
    get_block_response,
    get_feed_history_response,
)

if TYPE_CHECKING:
    from workerbee.chain_observers.classifiers.collector_classifier_base import IEvaluationContextClass
    from workerbee.chain_observers.collectors.collector_base import TCollectorResult
    from workerbee.chain_observers.factories.data_evaluation_context import TCollectorEvaluationContext
    from workerbee.chain_observers.interfaces import IWorkerBee

# ---------------------------------------------------------------------------
# Synthetic data builders
# ---------------------------------------------------------------------------


def make_operation(type_name: str, value_dict: dict[str, Any]) -> Hf26Operation:
    """Build a real hf26 operation of hiveio_api (the shape WorkerBee's APIs return) - from a partial body too."""
    transaction = Transaction.from_builtins(
        {"operations": [{"type": type_name, "value": value_dict}]},
        warn=False,  # bodies of tests hold only the members the tested code reads
    )
    return transaction.operations[0]


def make_transaction(*operations: Hf26Operation) -> Transaction:
    """Build a real hf26 transaction of hiveio_api carrying the given operations."""
    transaction = Transaction.from_builtins({"operations": []}, warn=False)
    transaction.operations = list(operations)
    return transaction


class FixedCollector(CollectorBase):
    """Collector whose get() returns pre-set results of classifiers."""

    def __init__(self, result: TCollectorResult) -> None:
        super().__init__(cast("IWorkerBee", None))
        self._result = result

    async def get(self, data: TCollectorEvaluationContext) -> TCollectorResult:
        return self._result


def make_data_context(*injections: tuple[IEvaluationContextClass, TCollectorResult]) -> DataEvaluationContext:
    """Build a DataEvaluationContext and inject classifier -> fixed collector pairs."""
    factory = FactoryBase(cast("IWorkerBee", None))
    ctx = DataEvaluationContext(factory)
    for classifier, data in injections:
        ctx.inject(classifier, FixedCollector(data))
    return ctx


# ---------------------------------------------------------------------------
# Fake chain — replaces MagicMock/AsyncMock
# ---------------------------------------------------------------------------


class _DGP:
    head_block_number = 100
    current_witness = "witness-a"
    time = HiveDateTime("2024-06-15T12:00:00")
    head_block_id = "0000006400000000000000000000000000000000"
    downvote_pool_percent = 25


class _FakeDatabaseApi:
    async def get_dynamic_global_properties(self) -> _DGP:
        return _DGP()

    async def find_accounts(self, **kwargs: object) -> object:
        return find_accounts_response(build_account("alice"))

    async def find_witnesses(self, **kwargs: object) -> object:
        return find_witnesses_response(build_witness("witness-a", total_missed=0))

    async def get_feed_history(self, **kwargs: object) -> GetFeedHistoryResponse:
        return get_feed_history_response(build_price(330, 1000))

    async def find_change_recovery_account_requests(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(requests=[])

    async def find_decline_voting_rights_requests(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(requests=[])


def _block() -> Block:
    return build_block(
        witness="witness-a",
        timestamp=HiveDateTime("2024-06-15T12:00:00"),
        block_id="0000006400000000000000000000000000000000",
    )


class _FakeBlockApi:
    async def get_block(self, **kwargs: object) -> GetBlockResponse:
        return get_block_response(_block())

    async def get_block_range(self, **kwargs: object) -> GetBlockRangeResponse:
        return get_block_range_response(_block())


class _FakeRcApi:
    async def find_rc_accounts(self, **kwargs: object) -> object:
        return find_rc_accounts_response(build_rc_account("alice", max_rc=1000000))


class _FakeApi:
    def __init__(self) -> None:
        self.database_api = _FakeDatabaseApi()
        self.block_api = _FakeBlockApi()
        self.rc_api = _FakeRcApi()


class FakeChain:
    """Pure fake that mimics the hiveio-wax chain interface without unittest.mock."""

    def __init__(self) -> None:
        self.endpoint_url = "https://mock.api/"
        self.api = _FakeApi()

    def extends(self, *args: object) -> FakeChain:
        return self

    async def aclose(self) -> None:
        pass

    def get_operation_impacted_accounts(self, op: dict[str, Any]) -> list[str]:
        # ImpactedAccountCollector passes the envelope of the operation ({"type", "value"}), the form wax takes.
        body = op["value"]
        return [body[field] for field in ("voter", "author", "from", "to", "creator", "new_account_name") if body.get(field)]


class FakeWorker:
    """Worker-like fake exposing the chain attribute used by collectors and factories."""

    def __init__(self, chain: FakeChain) -> None:
        self.chain = chain


@pytest.fixture()
def mock_chain() -> FakeChain:
    """Return a fake object that mimics the hiveio-wax chain interface."""
    return FakeChain()


@pytest.fixture()
def mock_worker(mock_chain: FakeChain) -> FakeWorker:
    """Worker-like object where worker.chain is the mock_chain."""
    return FakeWorker(mock_chain)
