"""PostMentionFilter — matches @mentions in comment body.

Mirrors src/chain-observers/filters/post-mention.ts.

Uses OperationClassifier. Regex matches @mentions in comment body.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext

_MENTION_REGEX = re.compile(r"@([a-z]+[a-z0-9.\-]+[a-z0-9]+\b)")


class PostMentionFilter(FilterBase):
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

        comment_ops = operations_per_type.get("comment_operation", [])
        for entry in comment_ops:
            body = entry["operation"]["body"]
            if not isinstance(body, str):
                continue
            for match in _MENTION_REGEX.finditer(body):
                mentioned_account = match.group(1)
                if mentioned_account in self._accounts:
                    return True

        return False
