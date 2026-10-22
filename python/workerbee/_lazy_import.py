"""Lazily imported public names of packages - a module ``__getattr__`` (PEP 562)."""

from __future__ import annotations

import importlib
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import Callable, Mapping


def lazy_getattr(package_globals: dict[str, object], modules: Mapping[str, str]) -> Callable[[str], object]:
    """The ``__getattr__`` of a package importing each name of ``modules`` (name -> module) on its first access.

    Modules are relative to the package (e.g. ``".bot"``). An imported name is kept in the package, so later accesses
    do not call ``__getattr__`` again.
    """
    package = str(package_globals["__name__"])

    def __getattr__(name: str) -> object:
        module = modules.get(name)
        if module is None:
            raise AttributeError(f"module {package!r} has no attribute {name!r}")
        value = getattr(importlib.import_module(module, package), name)
        package_globals[name] = value
        return value

    return __getattr__
