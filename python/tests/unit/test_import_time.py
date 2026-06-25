"""Permanent guard: ``import workerbee`` must stay lazy.

The public top-level names are loaded lazily (the ``smart_lazy_import`` mechanism
the hiveio_api packages use), so importing the package must NOT pull in the heavy
``chain_observers`` tree — or the hiveio_api models it references — at import
time. This test fails if a heavy eager import sneaks into ``workerbee/__init__``.
"""

from __future__ import annotations

import json
import subprocess
import sys
from typing import TypedDict

_IMPORT_TIME_BUDGET_MS = 100.0


class _ImportGuardResult(TypedDict):
    elapsed_ms: float
    loaded_modules: list[str]


_IMPORT_GUARD_SNIPPET = """
import json
import sys

import workerbee

loaded_modules = sorted(
    name
    for name in sys.modules
    if name == "workerbee.chain_observers"
    or name.startswith("workerbee.chain_observers.")
    or name == "hiveio_api"
    or name.startswith("hiveio_api.")
)
print(json.dumps(loaded_modules))
"""


def _workerbee_import_time_ms(importtime_output: str) -> float:
    for line in reversed(importtime_output.splitlines()):
        if not line.startswith("import time:"):
            continue

        columns = line.removeprefix("import time:").split("|")
        if len(columns) != 3:
            continue

        cumulative_us = columns[1].strip()
        module = columns[2].strip()
        if module == "workerbee":
            return int(cumulative_us) / 1000

    raise AssertionError(f"`python -X importtime` did not report workerbee import time:\n{importtime_output}")


def _top_level_import_profile() -> _ImportGuardResult:
    proc = subprocess.run(
        [sys.executable, "-X", "importtime", "-c", _IMPORT_GUARD_SNIPPET],
        capture_output=True,
        text=True,
        check=True,
    )
    loaded_modules = json.loads(proc.stdout)
    assert isinstance(loaded_modules, list)

    return {
        "elapsed_ms": _workerbee_import_time_ms(proc.stderr),
        "loaded_modules": [str(name) for name in loaded_modules],
    }


def test_import_workerbee_stays_lazy_and_fast() -> None:
    profile = _top_level_import_profile()
    loaded_modules = profile["loaded_modules"]

    assert loaded_modules == [], (
        "`import workerbee` eagerly loaded heavy modules. Keep the public names lazy "
        f"(smart_lazy_import) so chain_observers loads on demand. Loaded: {loaded_modules}"
    )
    assert profile["elapsed_ms"] < _IMPORT_TIME_BUDGET_MS, (
        f"`import workerbee` took {profile['elapsed_ms']:.1f} ms; keep it under {_IMPORT_TIME_BUDGET_MS:.0f} ms."
    )
