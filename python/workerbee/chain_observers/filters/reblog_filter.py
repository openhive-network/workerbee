"""ReblogFilter — matches custom_json with id="follow" where json[0]=="reblog".

Mirrors src/chain-observers/filters/reblog-filter.ts.

Uses OperationClassifier.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class ReblogFilter(FilterBase):
    def __init__(self, accounts: list[str]) -> None:
        super().__init__()
        self._accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        custom_json_ops = operations_per_type.get("custom_json_operation", [])
        for entry in custom_json_ops:
            operation = entry["operation"]
            if operation["id"] == "follow":
                json_payload = operation.get("json")
                if not isinstance(json_payload, str):
                    continue
                try:
                    parsed = json.loads(json_payload)
                    if parsed[0] == "reblog" and parsed[1]["account"] in self._accounts:
                        return True
                except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                    pass

        return False
