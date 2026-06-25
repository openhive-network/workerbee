"""PostProvider — provides post (top-level comment) operations grouped by author.

Mirrors the PostProvider from src/chain-observers/providers/blog-content-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import OpBodyTransactionPair, PostsPayload


class PostProvider(ProviderBase):
    def __init__(self) -> None:
        self.authors: dict[str, None] = {}

    def push_options(self, options: Any) -> None:
        for account in options["authors"]:
            self.authors[account] = None

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> PostsPayload:
        posts: dict[str, list[OpBodyTransactionPair]] = {}

        operations = await data.get(OperationClassifier)
        comment_ops = operations["operations_per_type"].get("comment_operation")
        if comment_ops:
            for operation in comment_ops:
                # Posts have empty parent_author
                if operation["operation"]["parent_author"] != "":
                    continue

                author = operation["operation"]["author"]
                if author not in self.authors:
                    continue

                if author not in posts:
                    posts[author] = []

                posts[author].append(
                    {
                        "operation": operation["operation"],
                        "transaction": operation["transaction"],
                    }
                )

        return {"posts": posts}
