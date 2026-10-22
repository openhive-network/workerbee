"""Transactions of blocks - the data of BlockClassifier, shared by the JSON-RPC and the history data BlockCollector."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ...classifier_results import BlockClassifierData

if TYPE_CHECKING:
    from collections.abc import Iterable

    from hiveio_api.block_api import Block
    from hiveio_api.operations import Transaction

    from ...payloads import TransactionData


def collect_block_transactions(blocks: Iterable[Block]) -> BlockClassifierData:
    """The transactions of the blocks (in order) paired with their ids, and the transactions per id."""
    transactions: list[TransactionData] = []
    transactions_per_id: dict[str, Transaction] = {}

    for block in blocks:
        ids = block.transaction_ids
        for index, transaction in enumerate(block.transactions):
            # TS reads `transaction_ids[i]` - a block missing ids (e.g. of recorded mock data) still has its transactions.
            tx_id = ids[index] if index < len(ids) else ""
            transactions.append({"transaction": transaction, "id": tx_id})
            transactions_per_id[tx_id] = transaction

    return BlockClassifierData(transactions=transactions, transactions_per_id=transactions_per_id)
