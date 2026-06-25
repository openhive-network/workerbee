"""MentionedAccountProvider — provides comment operations that mention tracked accounts.

Mirrors src/chain-observers/providers/mention-provider.ts.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import MentionsPayload, OperationBodiesByAccount

_MENTION_REGEX = re.compile(r"@([a-z]+[a-z0-9.\-]+[a-z0-9]+\b)")


class MentionedAccountProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: Any) -> None:
        for account in options["accounts"]:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> MentionsPayload:
        mentioned: OperationBodiesByAccount = {}

        operations = await data.get(OperationClassifier)
        comment_ops = operations["operations_per_type"].get("comment_operation")

        post_metadata_set: set[str] = set()

        if comment_ops:
            for op_pair in comment_ops:
                operation = op_pair["operation"]
                post_hash = f"{operation['author']}-{operation['permlink']}"

                if post_hash in post_metadata_set:
                    continue
                post_metadata_set.add(post_hash)

                body = operation.get("body")
                if not isinstance(body, str):
                    continue

                found_mention = False
                for match in _MENTION_REGEX.finditer(body):
                    if found_mention:
                        break
                    mentioned_account = match.group(1)
                    if mentioned_account in self.accounts:
                        if mentioned_account not in mentioned:
                            mentioned[mentioned_account] = []
                        mentioned[mentioned_account].append(operation)
                        found_mention = True

        return {"mentioned": mentioned}
