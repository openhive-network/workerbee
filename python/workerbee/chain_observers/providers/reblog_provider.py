"""ReblogProvider — provides reblog operations grouped by account.

Mirrors src/chain-observers/providers/reblog-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._follow_plugin import parse_reblog_operation
from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import ReblogOperationPair, ReblogsPayload

ReblogOptions = dict[str, list[str]]


class ReblogProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: ReblogOptions) -> None:
        accounts = options.get("accounts", [])
        if not accounts:
            raise ValueError("accounts must not be empty")
        for account in accounts:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> ReblogsPayload:
        result: dict[str, list[ReblogOperationPair]] = {}

        operations = await data.get(OperationClassifier)
        for entry in operations["operations_per_type"].get("custom_json_operation", []):
            reblog = parse_reblog_operation(entry["operation"])
            if reblog is None or reblog["account"] not in self.accounts:
                continue
            result.setdefault(reblog["account"], []).append({"operation": reblog, "transaction": entry["transaction"]})

        return {"reblogs": result}
