"""FollowProvider — provides follow operations grouped by follower account.

Mirrors src/chain-observers/providers/follow-provider.ts.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

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
        custom_json_ops = operations["operations_per_type"].get("custom_json_operation")
        if custom_json_ops:
            for operation in custom_json_ops:
                if operation["operation"]["id"] != "follow":
                    continue

                json_payload = operation["operation"].get("json")
                if not isinstance(json_payload, str):
                    continue

                try:
                    parsed = json.loads(json_payload)
                except (json.JSONDecodeError, TypeError):
                    continue

                if not isinstance(parsed, list) or len(parsed) < 2 or not isinstance(parsed[1], dict):
                    continue

                payload = parsed[1]
                follower = payload.get("follower")
                following = payload.get("following")
                what = payload.get("what")

                if parsed[0] != "follow" or not isinstance(follower, str) or follower not in self.accounts:
                    continue

                if not isinstance(following, str) or not isinstance(what, list):
                    continue

                if follower not in result:
                    result[follower] = []

                result[follower].append(
                    {
                        "operation": {
                            "follower": follower,
                            "following": following,
                            "what": what,
                        },
                        "transaction": operation["transaction"],
                    }
                )

        return {"follows": result}
