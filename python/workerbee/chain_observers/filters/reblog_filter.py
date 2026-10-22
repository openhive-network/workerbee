"""ReblogFilter — matches custom_json with id="follow" where json[0]=="reblog".

Mirrors src/chain-observers/filters/reblog-filter.ts.

Uses OperationClassifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._follow_plugin import parse_reblog_operation
from .._ordered_set import OrderedSet
from ..classifiers.operation_classifier import OperationClassifier
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class ReblogFilter(FilterBase):
    def __init__(self, accounts: list[str]) -> None:
        super().__init__()
        self._accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        for entry in operations_per_type.get("custom_json_operation", []):
            reblog = parse_reblog_operation(entry["operation"])
            if reblog is not None and reblog["account"] in self._accounts:
                return True

        return False
