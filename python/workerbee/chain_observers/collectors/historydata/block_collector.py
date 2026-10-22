"""BlockCollector (HistoryData) — fetches blocks for historical range replay.

Mirrors src/chain-observers/collectors/historydata/block-collector.ts.
Uses batched get_block_range via wax block_api for performance.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...classifier_results import BlockClassifierData
from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.block_header_classifier import BlockHeaderClassifier
from ...errors import WorkerBeeError
from ..collector_base import CollectorBase, TCollectorResult
from ..common.block_transactions import collect_block_transactions

if TYPE_CHECKING:
    from hiveio_api.block_api import Block

    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...interfaces import IWorkerBee
    from ...payloads import BlockHeaderData

MAX_TAKE_BLOCKS = 1_000


class HistoryDataBlockCollector(CollectorBase):
    def __init__(self, worker: IWorkerBee, from_block: int, to_block: int | None = None) -> None:
        super().__init__(worker)
        self._from_block = from_block
        self._to_block = to_block
        self._current_block_index = from_block
        self._current_container_index = -1
        self._cached_blocks: list[Block] = []
        self._previous_header: BlockHeaderData | None = None

        if to_block is not None and from_block > to_block:
            raise WorkerBeeError(f"Invalid block range in history data BlockCollector: {from_block} > {to_block}")

    async def get(self, data: TCollectorEvaluationContext) -> TCollectorResult:
        if self._current_block_index < 1:
            raise WorkerBeeError(
                f"BlockCollector: No blocks returned from get_block_range starting from block #{self._from_block}",
            )

        if self._to_block is not None and self._current_block_index > self._to_block:
            raise WorkerBeeError(
                f"Block buffer overflow in history data BlockCollector: {self._current_block_index} > {self._to_block}",
            )

        if self._current_container_index == -1 or self._current_container_index >= len(self._cached_blocks):
            self._current_container_index = 0

            count = MAX_TAKE_BLOCKS
            if self._to_block is not None:
                remaining = self._to_block - self._current_block_index + 1
                count = min(count, remaining)

            with data.add_timing("block_api.get_block_range"):
                result = await self.worker.chain.api.block_api.get_block_range(
                    starting_block_num=self._current_block_index,
                    count=count,
                )

            blocks = result.blocks
            if not blocks:
                if self._current_block_index == self._from_block:
                    raise WorkerBeeError(
                        f"BlockCollector: No blocks returned from get_block_range starting from block #{self._from_block}",
                    )
                return {
                    BlockClassifier: BlockClassifierData(transactions=[], transactions_per_id={}),
                    BlockHeaderClassifier: self._previous_header,
                }

            self._cached_blocks = blocks

        with data.add_timing("block_analysis"):
            block = self._cached_blocks[self._current_container_index]

            block_data = collect_block_transactions([block])
            block_num = self._current_block_index

            self._current_container_index += 1
            self._current_block_index += 1

        self._previous_header = {
            "number": block_num,
            "timestamp": block.timestamp,
            "witness": block.witness,
            "id": block.block_id,
        }

        return {
            BlockClassifier: block_data,
            BlockHeaderClassifier: self._previous_header,
        }
