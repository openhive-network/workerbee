"""BlockCollector (HistoryData) — fetches blocks for historical range replay.

Mirrors src/chain-observers/collectors/historydata/block-collector.ts.
Uses batched get_block_range via wax block_api for performance.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.block_header_classifier import BlockHeaderClassifier
from ...errors import WorkerBeeError
from ...utils import parse_iso_timestamp
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...interfaces import IWorkerBee

MAX_TAKE_BLOCKS = 1_000


class HistoryDataBlockCollector(CollectorBase):
    def __init__(self, worker: IWorkerBee, from_block: int, to_block: int | None = None) -> None:
        super().__init__(worker)
        self._from_block = from_block
        self._to_block = to_block
        self._current_block_index = from_block
        self._current_container_index = -1
        self._cached_blocks: list[Any] = []
        self._previous_header: dict[str, Any] | None = None

        if to_block is not None and from_block > to_block:
            raise WorkerBeeError(f"Invalid block range in history data BlockCollector: {from_block} > {to_block}")

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
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

            blocks = result.blocks if hasattr(result, "blocks") else []
            if not blocks:
                if self._current_block_index == self._from_block:
                    raise WorkerBeeError(
                        f"BlockCollector: No blocks returned from get_block_range starting from block #{self._from_block}",
                    )
                return {
                    BlockClassifier.__name__: {"transactions": [], "transactions_per_id": {}},
                    BlockHeaderClassifier.__name__: self._previous_header,
                }

            self._cached_blocks = list(blocks)

        with data.add_timing("block_analysis"):
            block = self._cached_blocks[self._current_container_index]

            block_txs = block.transactions if hasattr(block, "transactions") else block.get("transactions", [])
            block_ids = block.transaction_ids if hasattr(block, "transaction_ids") else block.get("transaction_ids", [])

            transactions: list[dict[str, Any]] = []
            transactions_per_id: dict[str, Any] = {}

            for i, tx_raw in enumerate(block_txs):
                tx_id = block_ids[i] if i < len(block_ids) else ""
                transactions.append({"transaction": tx_raw, "id": tx_id})
                transactions_per_id[tx_id] = tx_raw

            block_num = self._current_block_index
            timestamp_str = block.timestamp if hasattr(block, "timestamp") else block.get("timestamp", "")
            witness = block.witness if hasattr(block, "witness") else block.get("witness", "")
            block_id = block.block_id if hasattr(block, "block_id") else block.get("block_id", "")
            parsed_ts = parse_iso_timestamp(timestamp_str) if timestamp_str else None

            self._current_container_index += 1
            self._current_block_index += 1

        self._previous_header = {
            "number": block_num,
            "timestamp": parsed_ts,
            "witness": witness,
            "id": block_id,
        }

        return {
            BlockClassifier.__name__: {
                "transactions": transactions,
                "transactions_per_id": transactions_per_id,
            },
            BlockHeaderClassifier.__name__: self._previous_header,
        }
