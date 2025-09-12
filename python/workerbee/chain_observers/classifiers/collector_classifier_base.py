from __future__ import annotations

from abc import ABC
from typing import Any, Generic, TypedDict

from typing_extensions import TypeVar


GetResultT = TypeVar("GetResultT", default=None)
QueryResultT = TypeVar("QueryResultT", default=None)
QueryOptionsT = TypeVar("QueryOptionsT", default=None)
OptionsT = TypeVar("OptionsT", default=None)
StoreT = TypeVar("StoreT", default=dict)


class CollectorClassifierBase(
    ABC, Generic[GetResultT, QueryResultT, QueryOptionsT, OptionsT, StoreT]
):
    name: str


EvaluationContextClass = type[CollectorClassifierBase]


class EvaluationContextOptions(TypedDict):
    class_: EvaluationContextClass
    options: dict[str, Any]


RegisterEvaluationContextT = EvaluationContextClass | EvaluationContextOptions
