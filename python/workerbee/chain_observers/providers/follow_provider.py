"""FollowProvider — provides follow operations grouped by follower account.

Mirrors src/chain-observers/providers/follow-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._follow_plugin import parse_follow_operation
from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import FollowOperationPair, FollowsPayload

FollowOptions = dict[str, list[str]]


class FollowProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: FollowOptions) -> None:
        accounts = options.get("accounts", [])
        if not accounts:
            raise ValueError("accounts must not be empty")
        for account in accounts:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> FollowsPayload:
        result: dict[str, list[FollowOperationPair]] = {}

        operations = await data.get(OperationClassifier)
        for entry in operations["operations_per_type"].get("custom_json_operation", []):
            follow = parse_follow_operation(entry["operation"])
            if follow is None or follow["follower"] not in self.accounts:
                continue
            result.setdefault(follow["follower"], []).append({"operation": follow, "transaction": entry["transaction"]})

        return {"follows": result}
