"""Shared fixtures for mirrornet-backed integration tests."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from wax.interfaces import IHiveChainInterface

from tests.integration._mirrornet import MirrornetReplay, open_mirrornet_chain
from workerbee import WorkerBee
from workerbee.chain_observers.wax_api import WorkerBeeApiCollection

_MIRRORNET_ENDPOINT_ENV = "WORKERBEE_MIRRORNET_ENDPOINT"
_MIRRORNET_ENDPOINT_OPTION = "--workerbee-mirrornet-endpoint"
_DEFAULT_MIRRORNET_ENDPOINT = "https://api.hive.blog"


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("workerbee")
    group.addoption(
        _MIRRORNET_ENDPOINT_OPTION,
        action="store",
        default=os.environ.get(_MIRRORNET_ENDPOINT_ENV, _DEFAULT_MIRRORNET_ENDPOINT),
        help=(f"Mirrornet RPC endpoint used by WorkerBee integration tests. Defaults to ${_MIRRORNET_ENDPOINT_ENV} or {_DEFAULT_MIRRORNET_ENDPOINT}."),
    )


@pytest.fixture(scope="session")
def mirrornet_endpoint(pytestconfig: pytest.Config) -> str:
    endpoint = str(pytestconfig.getoption(_MIRRORNET_ENDPOINT_OPTION))
    if not endpoint:
        pytest.fail(f"{_MIRRORNET_ENDPOINT_OPTION} must not be empty")
    return endpoint


@pytest.fixture()
def mirrornet_replay(mirrornet_endpoint: str) -> MirrornetReplay:
    return MirrornetReplay(mirrornet_endpoint)


@pytest_asyncio.fixture()
async def mirrornet_chain(mirrornet_endpoint: str) -> AsyncIterator[IHiveChainInterface[WorkerBeeApiCollection]]:
    async with open_mirrornet_chain(mirrornet_endpoint) as chain:
        yield chain


@pytest_asyncio.fixture()
async def workerbee(mirrornet_chain: IHiveChainInterface[WorkerBeeApiCollection]) -> AsyncIterator[WorkerBee]:
    async with WorkerBee(mirrornet_chain) as bot:
        yield bot


@pytest_asyncio.fixture()
async def inactive_workerbee(mirrornet_chain: IHiveChainInterface[WorkerBeeApiCollection]) -> AsyncIterator[WorkerBee]:
    bot = WorkerBee(mirrornet_chain)
    try:
        yield bot
    finally:
        await bot.aclose()
