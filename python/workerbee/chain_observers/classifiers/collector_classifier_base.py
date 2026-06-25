"""CollectorClassifierBase — base class for all classifiers.

In TS, CollectorClassifierBase<TStore, TGetResult, TQueryResult, TQueryOptions, TOptions>
uses 5 generic type params that are purely compile-time. In Python, the class object
itself serves as the dict key (identically to how TS uses classifier.name at runtime).
"""

from __future__ import annotations

from typing import Any


class CollectorClassifierBase[ClassifierResultT]:
    """Base class for all classifiers.

    Used as dict keys in DataEvaluationContext and FactoryBase.
    The class itself (not instances) is used as key — Python class objects are hashable.
    """

    pass


TRegisterEvaluationContext = type[CollectorClassifierBase[Any]] | dict[str, Any]
