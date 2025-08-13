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
    get_result: GetResultT | None = None
    query_result: QueryResultT | None = None
    query_options: QueryOptionsT | None = None
    options: OptionsT | None = None
    store: StoreT | None = None


GetResultT_co = TypeVar("GetResultT_co", covariant=True)
QueryResultT_co = TypeVar("QueryResultT_co", covariant=True)
QueryOptionsT_co = TypeVar("QueryOptionsT_co", covariant=True)
OptionsT_co = TypeVar("OptionsT_co", covariant=True)
StoreT_co = TypeVar("StoreT_co", covariant=True)


EvaluationContextClass = type[CollectorClassifierBase[Any, Any, Any, Any, Any]]


class Dataclass(Protocol):
    __dataclass_fields__: dict[str, Any]


class EvaluationContextDict(TypedDict):
    class_: type[CollectorClassifierBase[Any, Any, Any, Any, Any]]
    options: Dataclass | None


RegisterEvaluationContext = EvaluationContextClass | EvaluationContextDict
