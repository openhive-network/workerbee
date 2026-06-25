"""ReblogProvider — provides reblog operations grouped by account.

Mirrors src/chain-observers/providers/reblog-provider.ts.
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
                reblogger = payload.get("account")
                author = payload.get("author")
                permlink = payload.get("permlink")

                if parsed[0] != "reblog" or not isinstance(reblogger, str) or reblogger not in self.accounts:
                    continue

                if not isinstance(author, str) or not isinstance(permlink, str):
                    continue

                if reblogger not in result:
                    result[reblogger] = []

                result[reblogger].append(
                    {
                        "operation": {
                            "account": reblogger,
                            "author": author,
                            "permlink": permlink,
                        },
                        "transaction": operation["transaction"],
                    }
                )

        return {"reblogs": result}
