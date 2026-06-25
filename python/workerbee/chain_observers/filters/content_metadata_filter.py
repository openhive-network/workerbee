"""PostMetadataFilter / CommentMetadataFilter — content metadata filters.

Mirrors src/chain-observers/filters/content-metadata-filter.ts.

Uses ContentMetadataClassifier + OperationClassifier + ImpactedAccountClassifier.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class BlogContentMetadataFilter(FilterBase):
    """Base class for content metadata filters (posts and comments)."""

    def __init__(
        self,
        report_after_ms_before_payout: int,
        accounts: list[str],
        is_post: bool,
    ) -> None:
        super().__init__()
        self._report_after_ms_before_payout = report_after_ms_before_payout
        self._is_post = is_post
        self.accounts: OrderedSet[str] = OrderedSet(accounts)
        self._queried_posts: list[Any] = []

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.content_metadata_classifier import ContentMetadataClassifier
        from ..classifiers.impacted_account_classifier import ImpactedAccountClassifier
        from ..classifiers.operation_classifier import OperationClassifier

        return [ContentMetadataClassifier, OperationClassifier, ImpactedAccountClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.content_metadata_classifier import ContentMetadataClassifier
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        query_comments: list[Any] = [*self._queried_posts]
        self._queried_posts = []  # Reset for next match

        comment_ops = operations_per_type.get("comment_operation")
        if comment_ops:
            for entry in comment_ops:
                operation = entry["operation"]

                # Check if post/comment type matches what we're looking for
                post_indicator = operation["parent_author"] == ""
                if self._is_post != post_indicator:
                    continue

                # Check author match
                if operation["author"] not in self.accounts:
                    continue

                query_comments.append(operation)

        if len(query_comments) > 0:
            comments = await data.query(
                ContentMetadataClassifier,
                {
                    "requested_data": query_comments,
                    "report_after_ms_before_payout": self._report_after_ms_before_payout,
                },
            )

            for operation in query_comments:
                if not comments.get(operation["author"], {}).get(operation["permlink"]):
                    self._queried_posts.append(operation)  # Add back if not found

        content_result = await data.get(ContentMetadataClassifier)
        content_data = content_result["content_data"]
        return bool(content_data)


class CommentMetadataFilter(BlogContentMetadataFilter):
    """Filter for comment metadata (replies to posts or other comments)."""

    def __init__(self, report_after_ms_before_payout: int, accounts: list[str]) -> None:
        super().__init__(report_after_ms_before_payout, accounts, False)


class PostMetadataFilter(BlogContentMetadataFilter):
    """Filter for post metadata (top-level content with empty parent_author)."""

    def __init__(self, report_after_ms_before_payout: int, accounts: list[str]) -> None:
        super().__init__(report_after_ms_before_payout, accounts, True)
