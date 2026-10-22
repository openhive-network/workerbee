"""CollectorClassifierBase — base class for all classifiers.

In TS, CollectorClassifierBase<TStore, TGetResult, TQueryResult, TQueryOptions, TOptions>
uses 5 generic type params that are purely compile-time. In Python, the class object
itself serves as the dict key (where TS uses classifier.name at runtime) and its type
parameter is the type of the result of the classifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, NotRequired, TypedDict

if TYPE_CHECKING:
    from collections.abc import Mapping


class CollectorClassifierBase[ClassifierResultT]:
    """Base class for all classifiers.

    Used as dict keys in DataEvaluationContext and FactoryBase.
    The class itself (not instances) is used as key — Python class objects are hashable.
    """

    pass


type IEvaluationContextClass = type[CollectorClassifierBase[object]]
"""Any classifier class (TS ``IEvaluationContextClass``)."""

# ``class`` is a Python keyword → functional TypedDict syntax.
ClassifierWithOptions = TypedDict(
    "ClassifierWithOptions",
    {"class": "IEvaluationContextClass", "options": NotRequired["Mapping[str, object]"]},
)
"""A classifier together with the options its collector is registered with (``Classifier.for_options(...)``)."""

type TRegisterEvaluationContext = IEvaluationContextClass | ClassifierWithOptions
