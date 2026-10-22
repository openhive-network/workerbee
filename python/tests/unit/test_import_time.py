"""Permanent guard: importing WorkerBee stays lazy.

``import workerbee`` must not pull in the ``chain_observers`` tree (or the hiveio_api/wax packages it needs) - the
public names are loaded on their first access. ``from workerbee import WorkerBee`` loads the bot, but no concrete filter
or provider: a subscription loads only the ones it uses (``filters``/``providers`` import their modules lazily).
Each import runs in a fresh interpreter, and the modules it loads are compared with what was loaded before it.
"""

from __future__ import annotations

import importlib
import json
import subprocess
import sys

import pytest

_IMPORT_TIME_BUDGET_MS = 100.0

_SNIPPET = """
import json
import sys

before = set(sys.modules)
{statement}
print(json.dumps(sorted(set(sys.modules) - before)))
"""

_LIGHT_WORKERBEE_MODULES = {"workerbee", "workerbee._lazy_import"}
_HEAVY_STDLIB_PACKAGES = {"asyncio", "concurrent", "email"}

# The building blocks of every subscription (``QueenBee`` composes filters, providers are merged by the mediator).
_FILTERS_AND_PROVIDERS_OF_THE_BOT = {
    "workerbee.chain_observers.filters",
    "workerbee.chain_observers.filters.blank_filter",
    "workerbee.chain_observers.filters.composite_filter",
    "workerbee.chain_observers.filters.filter_base",
    "workerbee.chain_observers.providers",
    "workerbee.chain_observers.providers.provider_base",
}


def _run(statement: str, *python_options: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, *python_options, "-c", _SNIPPET.format(statement=statement)],
        capture_output=True,
        text=True,
        check=True,
    )


def _loaded_modules(statement: str) -> list[str]:
    loaded = json.loads(_run(statement).stdout)
    assert isinstance(loaded, list)
    return [str(name) for name in loaded]


def _filters_and_providers(modules: list[str]) -> set[str]:
    return {name for name in modules if name.startswith(("workerbee.chain_observers.filters", "workerbee.chain_observers.providers"))}


def _workerbee_import_time_ms(importtime_output: str) -> float:
    for line in reversed(importtime_output.splitlines()):
        columns = line.removeprefix("import time:").split("|")
        if line.startswith("import time:") and len(columns) == 3 and columns[2].strip() == "workerbee":
            return int(columns[1].strip()) / 1000
    raise AssertionError(f"`python -X importtime` did not report workerbee import time:\n{importtime_output}")


def test_import_workerbee_loads_only_the_package_and_light_standard_modules() -> None:
    def is_allowed(module: str) -> bool:
        if module.startswith("workerbee"):
            return module in _LIGHT_WORKERBEE_MODULES
        top_level = module.partition(".")[0]
        return top_level in sys.stdlib_module_names and top_level not in _HEAVY_STDLIB_PACKAGES and module != "importlib.metadata"

    loaded = _loaded_modules("import workerbee")

    assert "workerbee" in loaded
    assert [module for module in loaded if not is_allowed(module)] == [], "`import workerbee` loaded modules eagerly - keep the public names lazy"


def test_import_workerbee_is_fast() -> None:
    elapsed_ms = _workerbee_import_time_ms(_run("import workerbee", "-X", "importtime").stderr)

    assert elapsed_ms < _IMPORT_TIME_BUDGET_MS, f"`import workerbee` took {elapsed_ms:.1f} ms; keep it under {_IMPORT_TIME_BUDGET_MS:.0f} ms."


def test_importing_the_bot_loads_no_concrete_filter_or_provider() -> None:
    loaded = _loaded_modules("from workerbee import WorkerBee")

    assert "workerbee.chain_observers.bot" in loaded
    assert _filters_and_providers(loaded) == _FILTERS_AND_PROVIDERS_OF_THE_BOT


def test_filter_and_provider_are_loaded_on_first_access() -> None:
    loaded = _loaded_modules(
        "from workerbee import WorkerBee\n"
        "from workerbee.chain_observers.filters import VoteFilter\n"
        "from workerbee.chain_observers.providers import VoteProvider"
    )

    assert _filters_and_providers(loaded) == _FILTERS_AND_PROVIDERS_OF_THE_BOT | {
        "workerbee.chain_observers.filters.vote_filter",
        "workerbee.chain_observers.providers.vote_provider",
    }


@pytest.mark.parametrize("package", ["workerbee", "workerbee.chain_observers.filters", "workerbee.chain_observers.providers"])
def test_every_public_name_of_lazy_package_is_importable(package: str) -> None:
    module = importlib.import_module(package)

    for name in module.__all__:
        assert getattr(module, name).__name__ == name

    with pytest.raises(AttributeError, match="no attribute 'Missing'"):
        _ = module.Missing
