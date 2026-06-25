from __future__ import annotations

from ..classifier_results import ContentMetadataClassifierData
from .collector_classifier_base import CollectorClassifierBase


class ContentMetadataClassifier(CollectorClassifierBase[ContentMetadataClassifierData]):
    """IContentData:
      content_data: dict[str, dict[str, IHiveContentMetadata]]

    IHiveContentMetadata:
      category: str
      author: str
      permlink: str
      title: str
      parent_author: str
      parent_permlink: str
      net_rshares: int
      net_votes: int
      payout_time: datetime
      is_paid: bool
      total_payout_value: asset
      curator_payout_value: asset
      allows_replies: bool
      allows_votes: bool
      allows_curation_rewards: bool
      author_rewards: int

    TContentMetadataQueryOptions:
      requested_data: list[{author, permlink, parent_author, parent_permlink, title}]
      report_after_ms_before_payout: int | None
    """

    pass
