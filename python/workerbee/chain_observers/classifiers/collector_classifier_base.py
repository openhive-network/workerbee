from __future__ import annotations

from abc import ABC
from typing import Generic, Any, Protocol, TypedDict
from typing_extensions import TypeVar


GetResultT = TypeVar("GetResultT", default=None)
QueryResultT = TypeVar("QueryResultT", default=None)
QueryOptionsT = TypeVar("QueryOptionsT", default=None)
OptionsT = TypeVar("OptionsT", default=None)
StoreT = TypeVar("StoreT", default=dict)


class CollectorClassifierBase(
    ABC, Generic[GetResultT, QueryResultT, QueryOptionsT, OptionsT, StoreT]
):
    get_type: GetResultT
    query_type: QueryResultT
    query_options_type: QueryOptionsT
    options_type: OptionsT
    store_type: StoreT


EvaluationContextClass = type[CollectorClassifierBase[Any, Any, Any, Any, Any]]


class Dataclass(Protocol):
    __dataclass_fields__: dict[str, Any]


class EvaluationContextDict(TypedDict):
    class_: type[CollectorClassifierBase[Any, Any, Any, Any, Any]]
    options: Dataclass | None


RegisterEvaluationContext = EvaluationContextClass | EvaluationContextDict
