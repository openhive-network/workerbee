"""Subprocess wrapper for the TypeScript JSON-RPC mock server."""

from __future__ import annotations

import os
import selectors
import shutil
import signal
import socket
import subprocess
import threading
import time
from collections.abc import Awaitable, Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TextIO, cast

from wax.interfaces import IHiveChainInterface

from workerbee import WorkerBee
from workerbee.chain_observers.payloads import ObserverNotification
from workerbee.chain_observers.queen import Subscription

_REPO_ROOT = Path(__file__).resolve().parents[3]
_READY_PREFIX = "WORKERBEE_JS_MOCK_READY "
_START_TIMEOUT_SECS = 20.0
_SHUTDOWN_TIMEOUT_SECS = 5.0
MAX_MOCK_NOTIFY_CYCLES = 8

_MOCK_SERVER_SCRIPT = r"""
import { JsonRpcMock } from "./__tests__/assets/mock/api-mock.ts";
import jsonRpcMockData, { resetMockCallCounters } from "./__tests__/assets/mock/jsonRpcMock.ts";
import { createServer } from "./__tests__/assets/mock/proxy-mock-server.ts";

void (async () => {
  const port = Number.parseInt(process.env.WORKERBEE_JS_MOCK_PORT ?? "8000", 10);
  resetMockCallCounters();

  const closeServer = await createServer(new JsonRpcMock(jsonRpcMockData), port);
  const endpoint = `http://127.0.0.1:${port}`;
  console.log(`WORKERBEE_JS_MOCK_READY ${endpoint}`);

  const shutdown = async () => {
    await closeServer();
    process.exit(0);
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  await new Promise(() => {});
})();
"""


@contextmanager
def run_js_jsonrpc_mock_server() -> Iterator[str]:
    """Start the TypeScript JSON-RPC mock server and yield its endpoint."""
    port = _free_tcp_port()
    output: list[str] = []
    npx = shutil.which("npx")
    if npx is None:
        raise RuntimeError("npx is required to run the TypeScript JSON-RPC mock server")

    process = subprocess.Popen(
        [npx, "tsx", "--eval", _MOCK_SERVER_SCRIPT],
        cwd=_REPO_ROOT,
        env={**os.environ, "WORKERBEE_JS_MOCK_PORT": str(port)},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=True,
    )
    drain_thread: threading.Thread | None = None
    try:
        endpoint = _wait_for_ready(process, output)
        drain_thread = threading.Thread(
            target=_drain_output,
            args=(process, output),
            name="workerbee-js-jsonrpc-mock-output",
            daemon=True,
        )
        drain_thread.start()
        yield endpoint
    finally:
        _stop_process(process)
        if drain_thread is not None:
            drain_thread.join(timeout=_SHUTDOWN_TIMEOUT_SECS)
        if process.stdout is not None:
            process.stdout.close()


def _free_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_for_ready(process: subprocess.Popen[str], output: list[str]) -> str:
    stdout = process.stdout
    if stdout is None:
        raise RuntimeError("TypeScript JSON-RPC mock process has no stdout pipe")

    selector = selectors.DefaultSelector()
    selector.register(stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + _START_TIMEOUT_SECS
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                tail = stdout.read()
                if tail:
                    output.extend(tail.splitlines())
                raise RuntimeError(f"TypeScript JSON-RPC mock exited before readiness:\n{_format_output(output)}")

            timeout = max(0.0, min(0.1, deadline - time.monotonic()))
            for key, _events in selector.select(timeout=timeout):
                line = cast(TextIO, key.fileobj).readline()
                if not line:
                    continue
                stripped = line.rstrip()
                output.append(stripped)
                if stripped.startswith(_READY_PREFIX):
                    return stripped.removeprefix(_READY_PREFIX)
    finally:
        selector.unregister(stdout)

    _stop_process(process)
    raise RuntimeError(f"Timed out waiting for TypeScript JSON-RPC mock readiness:\n{_format_output(output)}")


def _drain_output(process: subprocess.Popen[str], output: list[str]) -> None:
    stdout = process.stdout
    if stdout is None:
        return
    for line in stdout:
        output.append(line.rstrip())


def _stop_process(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return

    _signal_process_group(process, signal.SIGTERM)
    try:
        process.wait(timeout=_SHUTDOWN_TIMEOUT_SECS)
    except subprocess.TimeoutExpired:
        _signal_process_group(process, signal.SIGKILL)
        process.wait(timeout=_SHUTDOWN_TIMEOUT_SECS)


def _signal_process_group(process: subprocess.Popen[str], signum: signal.Signals) -> None:
    try:
        os.killpg(process.pid, signum)
    except ProcessLookupError:
        return


def _format_output(output: list[str]) -> str:
    return "\n".join(output[-40:]) or "<no output>"


async def with_js_mock_bot[T](
    chain: IHiveChainInterface,
    callback: Callable[[WorkerBee], Awaitable[T]],
) -> T:
    """Run ``callback`` with a WorkerBee instance bound to the JS mock chain."""
    bot = WorkerBee(chain)
    try:
        return await callback(bot)
    finally:
        await bot.aclose()


async def collect_until(
    bot: WorkerBee,
    register: Callable[[list[ObserverNotification]], Subscription],
    is_done: Callable[[list[ObserverNotification]], bool],
    *,
    max_cycles: int = MAX_MOCK_NOTIFY_CYCLES,
) -> list[ObserverNotification]:
    """Drive deterministic mock notifications until ``is_done`` is true."""
    received: list[ObserverNotification] = []
    subscription = register(received)
    try:
        for _ in range(max_cycles):
            await bot.mediator.notify()
            await drain_mock_notifications(bot)
            if is_done(received):
                break
    finally:
        subscription.close()
    return received


async def drain_mock_notifications(bot: WorkerBee) -> None:
    """Wait for listener tasks scheduled by a manual mock ``notify()`` call."""
    await bot.mediator.drain()
