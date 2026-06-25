"""PostFilter / CommentFilter — match comment_operation for posts vs comments.

Mirrors src/chain-observers/filters/blog-content-filter.ts.

Post = parent_author is empty string.
Comment = parent_author is not empty.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


@dataclass
class ICommentData:
    parent_author: str
    parent_permlink: str


class BlogContentFilter(FilterBase):
    """Base class for content filters (posts and comments)."""

    def __init__(
        self,
        accounts: list[str],
        is_post: bool,
        parent_comment_filter: ICommentData | None = None,
    ) -> None:
        super().__init__()
        self._is_post = is_post
        self._parent_comment_filter = parent_comment_filter
        self.accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

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

                # Check parent data if specified
                if (
                    not self._is_post
                    and self._parent_comment_filter is not None
                    and (
                        operation["parent_permlink"] != self._parent_comment_filter.parent_permlink
                        or operation["parent_author"] != self._parent_comment_filter.parent_author
                    )
                ):
                    continue

                return True

        return False


class CommentFilter(BlogContentFilter):
    """Filter for comments (replies to posts or other comments)."""

    def __init__(
        self,
        accounts: list[str],
        parent_comment_filter: ICommentData | None = None,
    ) -> None:
        super().__init__(accounts, False, parent_comment_filter)


class PostFilter(BlogContentFilter):
    """Filter for posts (top-level content with empty parent_author)."""

    def __init__(self, accounts: list[str]) -> None:
        super().__init__(accounts, True)
