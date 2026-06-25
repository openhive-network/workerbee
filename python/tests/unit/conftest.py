"""Shared pytest fixtures for WorkerBee tests.

Provides fake chain objects and synthetic block builders so tests never
make real network calls.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, ClassVar, cast

import pytest
from hiveio_api.block_api import Operation

from workerbee.chain_observers.classifiers.collector_classifier_base import CollectorClassifierBase
from workerbee.chain_observers.collectors.collector_base import CollectorBase
from workerbee.chain_observers.factories.data_evaluation_context import DataEvaluationContext
from workerbee.chain_observers.factories.factory_base import FactoryBase

from ._builders import (
    build_account,
    build_rc_account,
    build_witness,
    find_accounts_response,
    find_rc_accounts_response,
    find_witnesses_response,
)

if TYPE_CHECKING:
    from workerbee.chain_observers.interfaces import IWorkerBee

# ---------------------------------------------------------------------------
# Synthetic data builders
# ---------------------------------------------------------------------------


def make_operation(type_name: str, value_dict: dict[str, Any]) -> Operation:
    """Build a real hf26 `Operation` struct (the shape WorkerBee's APIs return)."""
    return Operation(type=type_name, value=value_dict)


def make_transaction(tx_id: str, operations: list[dict[str, Any]]) -> dict[str, Any]:
    """Build a transaction dict with id and operations list."""
    return {
        "id": tx_id,
        "transaction": {"operations": operations},
    }


def make_block(
    number: int,
    witness: str = "witness-a",
    timestamp: str = "2024-06-15T12:00:00",
    transactions: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Build a synthetic block matching the block_api.get_block response shape."""
    txs = transactions or []
    return {
        "block": {
            "witness": witness,
            "timestamp": timestamp,
            "transaction_ids": [t["id"] for t in txs],
            "transactions": [t["transaction"] for t in txs],
        },
    }


class FixedCollector(CollectorBase):
    """Collector whose get() returns a pre-set classifier result dict."""

    def __init__(self, result: dict[str, Any]) -> None:
        super().__init__(cast("IWorkerBee", None))
        self._result = result

    async def get(self, data: Any) -> dict[str, Any]:
        return self._result


def make_data_context(*injections: tuple[type[CollectorClassifierBase], dict[str, Any]]) -> DataEvaluationContext:
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
    time = "2024-06-15T12:00:00"
    head_block_id = "0000006400000000000000000000000000000000"
    downvote_pool_percent = 25


class _FakeDatabaseApi:
    async def get_dynamic_global_properties(self) -> _DGP:
        return _DGP()

    async def find_accounts(self, **kwargs: object) -> object:
        return find_accounts_response(build_account("alice"))

    async def find_witnesses(self, **kwargs: object) -> object:
        return find_witnesses_response(build_witness("witness-a", total_missed=0))

    async def get_feed_history(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(
            price_history=[],
            current_median_history=SimpleNamespace(
                base=SimpleNamespace(amount="330", precision=3, nai="@@000000013"),
                quote=SimpleNamespace(amount="1000", precision=3, nai="@@000000021"),
            ),
        )

    async def find_change_recovery_account_requests(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(requests=[])

    async def find_decline_voting_rights_requests(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(requests=[])


class _FakeBlock:
    witness = "witness-a"
    timestamp = "2024-06-15T12:00:00"
    block_id = "0000006400000000000000000000000000000000"
    transaction_ids: ClassVar[list[str]] = []
    transactions: ClassVar[list[object]] = []
    transaction_merkle_root = ""
    extensions: ClassVar[list[object]] = []
    witness_signature = ""
    signing_key = ""
    previous = ""


class _FakeBlockApi:
    async def get_block(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(block=_FakeBlock())

    async def get_block_range(self, **kwargs: object) -> SimpleNamespace:
        return SimpleNamespace(blocks=[_FakeBlock()])


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

    def get_operation_impacted_accounts(self, op: object) -> list[str]:
        # hf26 Operation: the body is op.value (a dict). Fall back to dict for
        # any legacy-shaped fakes that might still pass an op body directly.
        body = op.value if hasattr(op, "value") else op
        names: list[str] = []
        if isinstance(body, dict):
            for field in ("voter", "author", "from", "to", "creator", "new_account_name"):
                v = body.get(field)
                if v:
                    names.append(v)
        return names


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
