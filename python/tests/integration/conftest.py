"""Shared fixtures for the mirrornet integration tests.

By default each test talks to a local node that replays the JSON-RPC calls
recorded in ``api-recordings/<test module>/<test name>.json.gz``. With
``$WORKERBEE_TEST_RECORD_FROM`` set to a node URL, calls missing from the
recording are forwarded to that node and a passing test saves them. With a
mirrornet endpoint given (``--workerbee-mirrornet-endpoint`` or
``$WORKERBEE_MIRRORNET_ENDPOINT``) the tests talk to that node directly.
"""

from __future__ import annotations

import os
import re
from collections.abc import AsyncIterator, Generator, Iterator
from typing import TextIO
from urllib.parse import urlsplit

import pytest
import pytest_asyncio
from wax.interfaces import IHiveChainInterface

from tests.integration._mirrornet import MirrornetReplay, open_mirrornet_chain
from tests.integration._recorded_node import RECORD_FROM_ENV, ApiRecording, serve_recording
from workerbee import WorkerBee

_MIRRORNET_ENDPOINT_ENV = "WORKERBEE_MIRRORNET_ENDPOINT"
_MIRRORNET_ENDPOINT_OPTION = "--workerbee-mirrornet-endpoint"
_MOCK_SERVER_LOG_OPTION = "--workerbee-mock-server-log"
_RECORDINGS_DIR = "api-recordings"
_CALL_PASSED = pytest.StashKey[bool]()


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("workerbee")
    group.addoption(
        _MIRRORNET_ENDPOINT_OPTION,
        action="store",
        default=os.environ.get(_MIRRORNET_ENDPOINT_ENV, ""),
        help=(
            f"Run the integration tests against this live RPC endpoint instead of their recorded responses. Defaults to ${_MIRRORNET_ENDPOINT_ENV}; "
            "when neither is set, the tests replay their recordings."
        ),
    )
    group.addoption(
        _MOCK_SERVER_LOG_OPTION,
        action="store",
        default="mock-server.log",
        help="File the recorded node logs every call it answers to (an xdist worker adds its id), relative to the rootdir.",
    )


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[None]) -> Generator[None, pytest.TestReport, pytest.TestReport]:
    report = yield
    if report.when == "call":
        item.stash[_CALL_PASSED] = report.passed
    return report


def _http_url(value: str, source: str) -> str:
    if urlsplit(value).scheme not in {"http", "https"}:
        pytest.fail(f"{source} must be an http(s) URL, got {value!r}")
    return value


@pytest.fixture(scope="session")
def mock_server_log(pytestconfig: pytest.Config) -> Iterator[TextIO]:
    path = pytestconfig.rootpath / str(pytestconfig.getoption(_MOCK_SERVER_LOG_OPTION))
    worker = os.environ.get("PYTEST_XDIST_WORKER")
    if worker is not None:
        path = path.with_name(f"{path.stem}-{worker}{path.suffix}")
    with path.open("w", buffering=1, encoding="utf-8") as log:
        yield log


@pytest.fixture()
def mirrornet_endpoint(pytestconfig: pytest.Config, request: pytest.FixtureRequest, mock_server_log: TextIO) -> Iterator[str]:
    live_endpoint = str(pytestconfig.getoption(_MIRRORNET_ENDPOINT_OPTION))
    if live_endpoint:
        yield _http_url(live_endpoint, _MIRRORNET_ENDPOINT_OPTION)
        return

    record_from = os.environ.get(RECORD_FROM_ENV) or None
    if record_from is not None:
        _http_url(record_from, f"${RECORD_FROM_ENV}")
    test_file = request.path
    recording = ApiRecording(test_file.parent / _RECORDINGS_DIR / test_file.stem / f"{re.sub(r'[^A-Za-z0-9_.-]', '-', request.node.name)}.json.gz")
    if record_from is None and not recording.path.exists():
        pytest.fail(f"{recording.path} is missing: record it by running the test with ${RECORD_FROM_ENV}=https://api.hive.blog")

    with serve_recording(recording, upstream=record_from, log=mock_server_log, test_id=request.node.nodeid) as endpoint:
        yield endpoint
    if record_from is not None and request.node.stash.get(_CALL_PASSED, False):
        recording.save()


@pytest.fixture()
def mirrornet_replay(mirrornet_endpoint: str) -> MirrornetReplay:
    return MirrornetReplay(mirrornet_endpoint)


@pytest_asyncio.fixture()
async def mirrornet_chain(mirrornet_endpoint: str) -> AsyncIterator[IHiveChainInterface]:
    async with open_mirrornet_chain(mirrornet_endpoint) as chain:
        yield chain


@pytest_asyncio.fixture()
async def workerbee(mirrornet_chain: IHiveChainInterface) -> AsyncIterator[WorkerBee]:
    async with WorkerBee(mirrornet_chain) as bot:
        yield bot


@pytest_asyncio.fixture()
async def inactive_workerbee(mirrornet_chain: IHiveChainInterface) -> AsyncIterator[WorkerBee]:
    bot = WorkerBee(mirrornet_chain)
    try:
        yield bot
    finally:
        await bot.aclose()
