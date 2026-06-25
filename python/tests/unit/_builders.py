"""Builders for real hiveio_api chain models used as test fixtures.

WorkerBee never hand-rolls chain-data shapes (CLAUDE.md): test fakes must be
real ``hiveio_api`` ``msgspec.Struct`` instances, not ``SimpleNamespace`` stand-ins.
``Account`` alone has 61 required fields, so rather than spell every field out we
fill required fields from the struct definition with type-appropriate zero values
(``msgspec.Struct.__init__`` does no validation, so loose zeros are fine) and let
callers override the few that matter via keyword arguments.

Eager hiveio_api imports here are intentional - tests are exempt from the
``import workerbee`` time budget (see ``tests/unit/test_import_time.py``).
"""

from __future__ import annotations

import types
import typing
from typing import Any, get_args, get_origin

import msgspec
from hiveio_api.database_api import Account, FindAccountsResponse, FindWitnessesResponse, Witness
from hiveio_api.rc_api import FindRcAccountsResponse, RcAccount

_NODEFAULT = msgspec.NODEFAULT


def _zero(annotation: Any) -> Any:
    """Return a benign zero value for a msgspec field annotation.

    Recurses into nested Structs, unwraps unions (skipping ``None``/``Unset``),
    and empties containers.
    """
    origin = get_origin(annotation)

    if origin is types.UnionType or origin is typing.Union:
        for arg in get_args(annotation):
            if arg not in (type(None), msgspec.UnsetType):
                return _zero(arg)
        return None

    if origin in (list, set, frozenset, tuple):
        return []
    if origin is dict:
        return {}

    if isinstance(annotation, type):
        if issubclass(annotation, msgspec.Struct):
            return _build(annotation)
        if issubclass(annotation, bool):
            return False
        if issubclass(annotation, int):
            return 0
        if issubclass(annotation, float):
            return 0.0
        if issubclass(annotation, str):
            return ""

    return None


def _build(cls: type[msgspec.Struct], **overrides: Any) -> Any:
    """Construct ``cls`` with all required fields defaulted; apply ``overrides``."""
    kwargs: dict[str, Any] = dict(overrides)
    for field in msgspec.structs.fields(cls):
        if field.name in kwargs:
            continue
        if field.default is not _NODEFAULT or field.default_factory is not _NODEFAULT:
            continue
        kwargs[field.name] = _zero(field.type)
    return cls(**kwargs)


def build_account(name: str = "alice", **overrides: Any) -> Account:
    """A real ``database_api.Account`` with sensible JSON-metadata defaults."""
    overrides.setdefault("json_metadata", "{}")
    overrides.setdefault("posting_json_metadata", "{}")
    return _build(Account, name=name, **overrides)


def build_witness(owner: str = "witness-a", **overrides: Any) -> Witness:
    """A real ``database_api.Witness``."""
    return _build(Witness, owner=owner, **overrides)


def build_rc_account(account: str = "alice", **overrides: Any) -> RcAccount:
    """A real ``rc_api.RcAccount``."""
    return _build(RcAccount, account=account, **overrides)


def find_accounts_response(*accounts: Account) -> FindAccountsResponse:
    """Wrap accounts in a real ``find_accounts`` response."""
    return _build(FindAccountsResponse, accounts=list(accounts))


def find_witnesses_response(*witnesses: Witness) -> FindWitnessesResponse:
    """Wrap witnesses in a real ``find_witnesses`` response."""
    return _build(FindWitnessesResponse, witnesses=list(witnesses))


def find_rc_accounts_response(*rc_accounts: RcAccount) -> FindRcAccountsResponse:
    """Wrap RC accounts in a real ``find_rc_accounts`` response."""
    return _build(FindRcAccountsResponse, rc_accounts=list(rc_accounts))
