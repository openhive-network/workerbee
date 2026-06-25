"""PostMetadataProvider + CommentMetadataProvider — content metadata providers.

Mirrors src/chain-observers/providers/content-metadata-provider.ts.
Separates posts (parent_author == "") from comments (parent_author != "").
"""

from __future__ import annotations

from abc import abstractmethod
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.content_metadata_classifier import ContentMetadataClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import CommentsMetadataPayload, ContentMetadata, PostsMetadataPayload

    # account -> permlink -> reshaped metadata
    ContentMetadataResult = dict[str, dict[str, ContentMetadata]]

ContentMetadataOptions = dict[str, list[str]]


class ContentMetadataProviderBase(ProviderBase):
    """Base class for post/comment metadata providers."""

    def __init__(self, is_post: bool) -> None:
        self.authors: OrderedSet[str] = OrderedSet()
        self._is_post: bool = is_post

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [ContentMetadataClassifier]

    @abstractmethod
    def push_options(self, options: ContentMetadataOptions) -> None: ...

    async def create_provider_data(self, data: DataEvaluationContext) -> ContentMetadataResult:
        content_result = await data.get(ContentMetadataClassifier)
        content_data: dict[str, dict[str, ContentMetadata]] = content_result.get("content_data", {})

        result: ContentMetadataResult = {}
        for account in self.authors:
            account_data = content_data.get(account)
            if not account_data:
                continue
            for permlink, post_metadata in account_data.items():
                post_indicator = post_metadata.get("parent_author", "") == ""
                if self._is_post != post_indicator:
                    continue

                if account not in result:
                    result[account] = {}
                result[account][permlink] = post_metadata

        return result


class PostMetadataProvider(ContentMetadataProviderBase):
    def __init__(self) -> None:
        super().__init__(is_post=True)

    def push_options(self, options: ContentMetadataOptions) -> None:
        authors = options.get("authors", [])
        if not authors:
            raise ValueError("authors must not be empty")
        for account in authors:
            self.authors.add(account)

    async def provide(self, data: DataEvaluationContext) -> PostsMetadataPayload:
        return {
            "posts_metadata": await self.create_provider_data(data),
        }


class CommentMetadataProvider(ContentMetadataProviderBase):
    def __init__(self) -> None:
        super().__init__(is_post=False)

    def push_options(self, options: ContentMetadataOptions) -> None:
        authors = options.get("authors", [])
        if not authors:
            raise ValueError("authors must not be empty")
        for account in authors:
            self.authors.add(account)

    async def provide(self, data: DataEvaluationContext) -> CommentsMetadataPayload:
        return {
            "comments_metadata": await self.create_provider_data(data),
        }
