"""A local Hive JSON-RPC node that replays (or records) the calls one test makes.

The recordings use the format of the TypeScript suite's
``__tests__/assets/mock/recorded-node.ts``: a gzipped JSON list of
``{"request": {"method", "params"}, "response": <JSON-RPC response without id>}``
in the order the node answered them.
"""

from __future__ import annotations

import gzip
import json
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import TextIO

import httpx

RECORD_FROM_ENV = "WORKERBEE_TEST_RECORD_FROM"

_UPSTREAM_TIMEOUT_SECS = 30.0
_LOGGED_PARAMS_CHARS = 200

type JsonValue = bool | int | float | str | list[JsonValue] | dict[str, JsonValue] | None
type JsonRpcResponse = dict[str, JsonValue]


def _call_key(method: str, params: JsonValue) -> str:
    return f"{method}:{json.dumps(params, sort_keys=True, separators=(',', ':'))}"


def _internal_error(message: str) -> JsonRpcResponse:
    return {"jsonrpc": "2.0", "error": {"code": -32603, "message": message}}


class ApiRecording:
    """The JSON-RPC calls one test made, stored gzipped at ``path``."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._calls: list[JsonValue] = json.loads(gzip.decompress(path.read_bytes())) if path.exists() else []
        self._responses: dict[str, list[JsonRpcResponse]] = {}
        self._changed = False
        for call in self._calls:
            if not isinstance(call, dict) or not isinstance(request := call["request"], dict) or not isinstance(response := call["response"], dict):
                raise ValueError(f"{path} holds a call that is not a request/response object: {call!r}")
            self._index(str(request["method"]), request["params"], response)

    def responses(self, method: str, params: JsonValue) -> list[JsonRpcResponse]:
        return self._responses.get(_call_key(method, params), [])

    def add(self, method: str, params: JsonValue, response: JsonRpcResponse) -> None:
        self._calls.append({"request": {"method": method, "params": params}, "response": response})
        self._index(method, params, response)
        self._changed = True

    def save(self) -> None:
        """Write the recording if calls were added, or if the file does not exist yet."""
        if not self._changed and self.path.exists():
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_bytes(gzip.compress(json.dumps(self._calls, separators=(",", ":")).encode(), compresslevel=9, mtime=0))
        self._changed = False

    def _index(self, method: str, params: JsonValue, response: JsonRpcResponse) -> None:
        self._responses.setdefault(_call_key(method, params), []).append(response)


class _UpstreamError(Exception):
    """The upstream node gave no JSON-RPC response object."""


class _RecordedNodeState:
    """Answers calls from an :class:`ApiRecording`, as ``RecordedJsonRpcNode`` does in the TS suite.

    A call gets the next response recorded for the same method and params; past
    the last one, the last one is repeated. With an upstream node, calls past the
    recorded ones are forwarded to it and added to the recording instead.
    """

    def __init__(self, recording: ApiRecording, upstream: str | None, log: TextIO, test_id: str) -> None:
        self._recording = recording
        self._upstream = upstream
        self._log = log
        self._test_id = test_id
        self._next_response: dict[str, int] = {}
        self._lock = threading.Lock()
        self._client = httpx.Client(timeout=_UPSTREAM_TIMEOUT_SECS) if upstream is not None else None

    def respond(self, method: str, params: JsonValue) -> JsonRpcResponse:
        key = _call_key(method, params)
        with self._lock:
            index = self._next_response.get(key, 0)
            self._next_response[key] = index + 1
            recorded = self._recording.responses(method, params)
            if index < len(recorded):
                return self._logged(method, params, f"replayed #{index + 1}", recorded[index])
            if self._upstream is None:
                if recorded:
                    return self._logged(method, params, f"repeated #{len(recorded)}", recorded[-1])
                return self._logged(
                    method,
                    params,
                    "MISSING",
                    _internal_error(
                        f"{self._recording.path.name} has no response recorded for {key}. Record it by running the test with {RECORD_FROM_ENV}=https://api.hive.blog"
                    ),
                )

        try:
            response = self._forward(method, params)
        except _UpstreamError as error:
            with self._lock:
                return self._logged(method, params, "UPSTREAM FAILED", _internal_error(str(error)))
        with self._lock:
            self._recording.add(method, params, response)
            return self._logged(method, params, "recorded", response)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()

    def _forward(self, method: str, params: JsonValue) -> JsonRpcResponse:
        if self._client is None or self._upstream is None:
            raise RuntimeError("the recorded node has no upstream to forward to")
        try:
            reply = self._client.post(self._upstream, json={"jsonrpc": "2.0", "id": 0, "method": method, "params": params})
            body = reply.json()
        except (httpx.HTTPError, json.JSONDecodeError) as error:
            raise _UpstreamError(f"{self._upstream} did not answer {method}: {error}") from error
        if not isinstance(body, dict):
            raise _UpstreamError(f"{self._upstream} answered {method} with a non-object: {body!r}")
        body.pop("id", None)
        return body

    def _logged(self, method: str, params: JsonValue, outcome: str, response: JsonRpcResponse) -> JsonRpcResponse:
        logged_params = json.dumps(params, separators=(",", ":"))[:_LOGGED_PARAMS_CHARS]
        self._log.write(f"{self._test_id} {outcome}: {method} {logged_params}\n")
        return response


class _JsonRpcHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server: _RecordedNodeServer

    def do_POST(self) -> None:
        body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        try:
            request = json.loads(body)
        except json.JSONDecodeError as error:
            self._reply(None, _internal_error(f"request is not JSON: {error}"))
            return
        if not isinstance(request, dict) or not isinstance(method := request.get("method"), str):
            self._reply(None, _internal_error("expected a single JSON-RPC request object with a string method"))
            return
        self._reply(request.get("id"), self.server.state.respond(method, request.get("params")))

    def log_message(self, format: str, *args: object) -> None:
        """Requests are logged by :class:`_RecordedNodeState`, not to stderr."""

    def _reply(self, request_id: JsonValue, response: JsonRpcResponse) -> None:
        payload = json.dumps({**response, "id": request_id}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class _RecordedNodeServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, state: _RecordedNodeState) -> None:
        super().__init__(("127.0.0.1", 0), _JsonRpcHandler)
        self.state = state


@contextmanager
def serve_recording(recording: ApiRecording, *, upstream: str | None, log: TextIO, test_id: str) -> Iterator[str]:
    """Serve ``recording`` on a free loopback port for the duration of the context; yields its URL.

    Each test gets its own server, so a bot left running by an earlier test
    cannot consume the responses meant for the current one.
    """
    state = _RecordedNodeState(recording, upstream, log, test_id)
    server = _RecordedNodeServer(state)
    thread = threading.Thread(target=server.serve_forever, name=f"recorded-node {test_id}", daemon=True)
    thread.start()
    log.write(f"{test_id} serving {recording.path} on port {server.server_port}" + (f", recording from {upstream}" if upstream else "") + "\n")
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
        state.close()
