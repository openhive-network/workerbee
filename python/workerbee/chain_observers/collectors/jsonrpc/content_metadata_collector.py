"""ContentMetadataCollector — fetches content metadata for pending payouts.

Mirrors src/chain-observers/collectors/jsonrpc/content-metadata-collector.ts.
Uses BucketAggregateQueue for time-based batch processing of payout notifications.
Supports both get() (dequeue scheduled items) and query() (immediate fetch + enqueue).
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING, cast

from ...classifier_results import ContentMetadataClassifierData
from ...classifiers.content_metadata_classifier import ContentMetadataClassifier
from ..bucket_aggregate_queue import BucketAggregateQueue
from ..collector_base import CollectorBase, TCollectorResult

if TYPE_CHECKING:
    from collections.abc import Mapping

    from hiveio_api.database_api import CashoutInfo

    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...interfaces import IWorkerBee
    from ...payloads import ContentMetadata

BUCKET_INTERVAL = 3 * 1000  # 3 seconds (Hive block interval) in ms
MAX_CONTENT_GET_LIMIT = 1000

ContentQueryItem = dict[str, str]
type ContentDataByAuthor = dict[str, dict[str, ContentMetadata]]


class ContentMetadataCollector(CollectorBase):
    def __init__(self, worker: IWorkerBee) -> None:
        super().__init__(worker)
        self._contract_timestamps: BucketAggregateQueue[ContentQueryItem] = BucketAggregateQueue(BUCKET_INTERVAL)
        self._content_cached: set[str] = set()

    async def _retrieve_data(
        self,
        data: TCollectorEvaluationContext,
        request_data: list[ContentQueryItem],
    ) -> ContentDataByAuthor:
        content_data: ContentDataByAuthor = {}

        operations_per_author_permlink: dict[str, dict[str, ContentQueryItem]] = {}
        for comm in request_data:
            author = comm.get("author", "")
            permlink = comm.get("permlink", "")
            if author not in operations_per_author_permlink:
                operations_per_author_permlink[author] = {}
            operations_per_author_permlink[author][permlink] = comm

        for i in range(0, len(request_data), MAX_CONTENT_GET_LIMIT):
            chunk = request_data[i : i + MAX_CONTENT_GET_LIMIT]
            comments_arg = [[item["author"], item["permlink"]] for item in chunk]

            with data.add_timing("database_api.get_comment_pending_payouts"):
                result = await self.worker.chain.api.database_api.get_comment_pending_payouts(
                    comments=comments_arg,
                )

            with data.add_timing("comments_analysis"):
                cashout_infos = result.cashout_infos

                for info in cashout_infos:
                    author = info.author
                    permlink = info.permlink

                    if author not in content_data:
                        content_data[author] = {}

                    matching_comment = operations_per_author_permlink.get(author, {}).get(permlink)
                    if not matching_comment:
                        raise RuntimeError(
                            f"Internal error: Content metadata for {author}/{permlink} not found in operations",
                        )

                    parent_author = matching_comment.get("parent_author", "")
                    parent_permlink = matching_comment.get("parent_permlink", "")
                    title = matching_comment.get("title", "")
                    category = parent_permlink if parent_author == "" else ""

                    cashout_info = info.cashout_info

                    if cashout_info is not None:
                        content_data[author][permlink] = _build_metadata_from_cashout(
                            author,
                            permlink,
                            parent_author,
                            parent_permlink,
                            category,
                            title,
                            cashout_info,
                        )
                    else:
                        content_data[author][permlink] = _build_paid_metadata(
                            author,
                            permlink,
                            parent_author,
                            parent_permlink,
                            category,
                            title,
                        )

        return content_data

    async def query(self, data: TCollectorEvaluationContext, options: Mapping[str, object]) -> ContentDataByAuthor:
        requested_data = cast("list[ContentQueryItem]", options.get("requested_data", []))
        report_after_ms = cast("int | None", options.get("report_after_ms_before_payout"))

        content_data = await self._retrieve_data(data, requested_data)

        if report_after_ms is not None:
            for author in content_data:
                for permlink in content_data[author]:
                    post_metadata = content_data[author][permlink]
                    payout_time = post_metadata["payout_time"]
                    if payout_time is None:  # already paid
                        continue

                    cache_key = f"{author}/{permlink}"
                    if cache_key in self._content_cached:
                        continue

                    rollback_after = int(payout_time.timestamp() * 1000) - report_after_ms

                    self._contract_timestamps.enqueue(
                        rollback_after,
                        {
                            "author": author,
                            "permlink": permlink,
                            "parent_author": post_metadata["parent_author"],
                            "parent_permlink": post_metadata["parent_permlink"],
                            "title": post_metadata["title"],
                        },
                    )
                    self._content_cached.add(cache_key)

        return content_data

    async def get(self, data: TCollectorEvaluationContext) -> TCollectorResult:
        all_data: list[ContentQueryItem] = []

        current_time = int(time.time() * 1000)
        for value in self._contract_timestamps.dequeue_until(current_time):
            all_data.append(value)
            author = value.get("author", "")
            permlink = value.get("permlink", "")
            self._content_cached.discard(f"{author}/{permlink}")

        if not all_data:
            return {ContentMetadataClassifier: ContentMetadataClassifierData(content_data={})}

        content_data = await self._retrieve_data(data, all_data)

        return {ContentMetadataClassifier: ContentMetadataClassifierData(content_data=content_data)}


def _build_metadata_from_cashout(
    author: str,
    permlink: str,
    parent_author: str,
    parent_permlink: str,
    category: str,
    title: str,
    cashout_info: CashoutInfo,
) -> ContentMetadata:
    return {
        "author": author,
        "permlink": permlink,
        "parent_author": parent_author,
        "parent_permlink": parent_permlink,
        "category": category,
        "title": title,
        "allows_curation_rewards": cashout_info.allow_curation_rewards,
        "allows_replies": cashout_info.allow_replies,
        "allows_votes": cashout_info.allow_votes,
        "author_rewards": int(cashout_info.author_rewards),
        "curator_payout_value": cashout_info.curator_payout_value,
        "net_rshares": int(cashout_info.net_rshares),
        "net_votes": cashout_info.net_votes,
        "payout_time": cashout_info.cashout_time,
        "is_paid": False,
        "total_payout_value": cashout_info.total_payout_value,
    }


def _build_paid_metadata(
    author: str,
    permlink: str,
    parent_author: str,
    parent_permlink: str,
    category: str,
    title: str,
) -> ContentMetadata:
    return {
        "author": author,
        "permlink": permlink,
        "parent_author": parent_author,
        "parent_permlink": parent_permlink,
        "category": category,
        "title": title,
        "allows_curation_rewards": False,
        "allows_replies": True,
        "allows_votes": True,
        "author_rewards": 0,
        "curator_payout_value": None,
        "net_rshares": 0,
        "net_votes": 0,
        "payout_time": None,
        "is_paid": True,
        "total_payout_value": None,
    }
