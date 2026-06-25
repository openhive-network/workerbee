"""HistoryDataFactory — registers subset of collectors for historical block replay.

Mirrors src/chain-observers/factories/historydata/factory.ts.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import TYPE_CHECKING

from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.block_header_classifier import BlockHeaderClassifier
from ...classifiers.content_metadata_classifier import ContentMetadataClassifier
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ...classifiers.impacted_account_classifier import ImpactedAccountClassifier
from ...classifiers.operation_classifier import OperationClassifier
from ...collectors.common.impacted_account_collector import ImpactedAccountCollector
from ...collectors.common.operation_collector import OperationCollector
from ...collectors.historydata.block_collector import HistoryDataBlockCollector
from ...collectors.historydata.dynamic_global_properties_collector import HistoryDataDynamicGlobalPropertiesCollector
from ...collectors.jsonrpc.content_metadata_collector import ContentMetadataCollector
from ..factory_base import EClassifierOrigin, FactoryBase

if TYPE_CHECKING:
    from ...interfaces import IWorkerBee
    from ...observer_mediator import ObserverMediator
    from ..data_evaluation_context import DataEvaluationContext


class HistoryDataFactory(FactoryBase):
    def __init__(self, worker: IWorkerBee, from_block: int, to_block: int | None = None) -> None:
        super().__init__(worker)

        self.from_block = from_block
        self.to_block = to_block
        self._notify_task: asyncio.Task[None] | None = None

        self.register_classifier(BlockHeaderClassifier, HistoryDataBlockCollector, worker, from_block, to_block)
        self.register_classifier(DynamicGlobalPropertiesClassifier, HistoryDataDynamicGlobalPropertiesCollector, worker)
        self.register_classifier(BlockClassifier, HistoryDataBlockCollector, worker, from_block, to_block)
        self.register_classifier(ImpactedAccountClassifier, ImpactedAccountCollector, worker)
        self.register_classifier(OperationClassifier, OperationCollector, worker)
        self.register_classifier(ContentMetadataClassifier, ContentMetadataCollector, worker)

        self.push_classifier(DynamicGlobalPropertiesClassifier, EClassifierOrigin.FACTORY)

    async def pre_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> bool:
        block_changed = await super().pre_notify(context, mediator)
        if not block_changed:
            await self._finish_replay(mediator)
            return False
        return True

    async def post_notify(self, context: DataEvaluationContext, mediator: ObserverMediator) -> None:
        await super().post_notify(context, mediator)
        if not mediator.has_listeners:
            return
        if self.to_block is not None and self._current_block_number is not None and self._current_block_number >= self.to_block:
            await self._finish_replay(mediator)
        else:
            self._notify_task = asyncio.create_task(mediator.notify())
            self._notify_task.add_done_callback(self._clear_notify_task)

    def cancel_replay(self) -> None:
        task = self._notify_task
        self._notify_task = None
        if task is not None and not task.done():
            task.cancel()

    async def _finish_replay(self, mediator: ObserverMediator) -> None:
        await mediator.aclose_all_listeners(cancel_pending=False)

    def _clear_notify_task(self, task: asyncio.Task[None]) -> None:
        if self._notify_task is task:
            self._notify_task = None
        with contextlib.suppress(asyncio.CancelledError, Exception):
            task.result()
