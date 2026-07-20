"""BlockCollector (JSON-RPC) — fetches blocks via block_api.

Mirrors src/chain-observers/collectors/jsonrpc/block-collector.ts at the API
boundary. The catch-up range is intentionally inclusive of the advertised head:
the current TS source has a shadowed range variable that can leave the collector
behind the head, while Python must not skip or strand the tail block.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from msgspec import UNSET

from ...classifiers.block_classifier import BlockClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ...errors import BlockNotAvailableError, WorkerBeeError
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...interfaces import IWorkerBee

MAX_BLOCK_RANGE_FETCH = 1_000


class BlockCollector(CollectorBase):
    def __init__(self, worker: IWorkerBee) -> None:
        super().__init__(worker)
        self._current_head_block = -1
        self._cached_block_data: dict[str, Any] | None = None

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [DynamicGlobalPropertiesClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        head_block_number: int = dgp["head_block_number"]

        if self._current_head_block == head_block_number and self._cached_block_data is not None:
            return {BlockClassifier.__name__: self._cached_block_data}

        api_blocks: list[Any] = []

        target_head_block = head_block_number

        # Catch up [current+1 .. head] INCLUSIVE. A complete response advances
        # to the advertised head; a partial response advances only to the last
        # fetched block so a later cycle retries the missing tail instead of
        # silently skipping it.
        gap = head_block_number - self._current_head_block if self._current_head_block != -1 else 0
        if self._current_head_block != -1 and gap > 1:
            if gap > MAX_BLOCK_RANGE_FETCH:
                raise WorkerBeeError(
                    f"Cannot catch up block range larger than {MAX_BLOCK_RANGE_FETCH} blocks. "
                    f"Current head: {self._current_head_block}, requested head: {head_block_number}",
                )

            with data.add_timing("block_api.get_block_range"):
                range_result = await self.worker.chain.api.block_api.get_block_range(
                    starting_block_num=self._current_head_block + 1,
                    count=gap,
                )

            fetched = range_result.blocks if hasattr(range_result, "blocks") else []
            if not fetched:
                raise WorkerBeeError(
                    f"Could not fetch missing blocks from {self._current_head_block + 1} to {head_block_number}",
                )
            api_blocks.extend(fetched)
            target_head_block = min(head_block_number, self._current_head_block + len(fetched))

        if not api_blocks:
            with data.add_timing("block_api.get_block"):
                block_result = await self.worker.chain.api.block_api.get_block(
                    block_num=head_block_number,
                )

            block = block_result.block if hasattr(block_result, "block") else None
            if block is None or block is UNSET:
                raise BlockNotAvailableError(head_block_number)
            api_blocks.append(block)

        self._current_head_block = target_head_block

        with data.add_timing("block_analysis"):
            transactions: list[dict[str, Any]] = []
            transactions_per_id: dict[str, Any] = {}

            for block in api_blocks:
                block_txs = block.transactions if hasattr(block, "transactions") else block.get("transactions", [])
                block_ids = block.transaction_ids if hasattr(block, "transaction_ids") else block.get("transaction_ids", [])
                for i, tx_raw in enumerate(block_txs):
                    tx_id = block_ids[i] if i < len(block_ids) else ""
                    transactions.append({"transaction": tx_raw, "id": tx_id})
                    transactions_per_id[tx_id] = tx_raw

        self._cached_block_data = {
            "transactions": transactions,
            "transactions_per_id": transactions_per_id,
        }

        return {BlockClassifier.__name__: self._cached_block_data}
