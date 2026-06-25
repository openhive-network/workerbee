"""Shared fixtures for tests backed by the TypeScript JSON-RPC mock server."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest_asyncio
from wax import WaxChainOptions, create_hive_chain
from wax.interfaces import IHiveChainInterface

from tests.mock._js_mock_server import run_js_jsonrpc_mock_server


@pytest_asyncio.fixture()
async def js_jsonrpc_mock_chain() -> AsyncIterator[IHiveChainInterface]:
    """Open a Wax chain connected to the TypeScript JSON-RPC mock server."""
    with run_js_jsonrpc_mock_server() as endpoint:
        async with create_hive_chain(WaxChainOptions(endpoint_url=endpoint)) as chain:
            yield chain
