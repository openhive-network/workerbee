"""Wax API extension for WorkerBee — adds block_api to the chain.

Mirrors src/wax/index.ts (chain.extend<WaxExtendTypes>).
"""

from __future__ import annotations

from typing import ClassVar

from hiveio_api.block_api import BlockApi
from wax.api.collection import WaxApiCollection


class WorkerBeeApiCollection(WaxApiCollection):
    # Annotation-only: wax's api_collection_factory binds each api to an
    # instance (class(owner=...)) at runtime via _API_MAP.
    #
    # Subclassing WaxApiCollection gives us its apis (database_api, ...) as
    # statically-typed attributes, so a chain typed as
    # ``IHiveChainInterface[WorkerBeeApiCollection]`` exposes both block_api and
    # the standard apis without any casts at the call sites.
    block_api: BlockApi

    # The factory consumes _API_MAP wholesale — it reads it from ``new_api``
    # (first base of the synthesised ``NewApi(WorkerBeeApiCollection,
    # WaxApiCollection)``), NOT a merge. So we re-export the standard apis
    # alongside block_api; otherwise resolving WaxApiCollection._API_MAP would
    # drop block_api.
    _API_MAP: ClassVar[dict[str, type]] = {
        **WaxApiCollection._API_MAP,
        "block_api": BlockApi,
    }
