"""CommentProvider — provides comment (reply) operations grouped by author.

Mirrors the CommentProvider from src/chain-observers/providers/blog-content-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import CommentsPayload, OpBodyTransactionPair


class CommentProvider(ProviderBase):
    def __init__(self) -> None:
        # Maps author -> optional parent_comment_filter (ICommentData with parent_permlink)
        self.authors: dict[str, dict[str, Any] | None] = {}

    def push_options(self, options: Any) -> None:
        for author_entry in options["authors"]:
            account = author_entry["account"]
            parent_comment_filter = author_entry.get("parent_comment_filter")
            self.authors[account] = parent_comment_filter

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> CommentsPayload:
        comments: dict[str, list[OpBodyTransactionPair]] = {}

        operations = await data.get(OperationClassifier)
        comment_ops = operations["operations_per_type"].get("comment_operation")
        if comment_ops:
            for operation in comment_ops:
                # Comments have non-empty parent_author (they are replies)
                if operation["operation"]["parent_author"] == "":
                    continue

                author = operation["operation"]["author"]
                if author not in self.authors:
                    continue

                # Apply parent comment filter if present
                parent_comment_filter = self.authors[author]
                if parent_comment_filter is not None and operation["operation"]["parent_permlink"] != parent_comment_filter["parent_permlink"]:
                    continue

                if author not in comments:
                    comments[author] = []

                comments[author].append(
                    {
                        "operation": operation["operation"],
                        "transaction": operation["transaction"],
                    }
                )

        return {"comments": comments}
