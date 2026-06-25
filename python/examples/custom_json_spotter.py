"""Custom-JSON spotter — prints transactions from blocks containing custom_json_operation.

Iterates live blocks with ``async for`` and inspects each block's operations
(hf26 ``Operation`` structs: ``op.type`` / ``op.value``).

Usage:
    python -m examples.custom_json_spotter [--api-endpoint URL]
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import os

from wax import WaxChainOptions, create_hive_chain

from workerbee import WorkerBee


async def main() -> None:
    parser = argparse.ArgumentParser(description="WorkerBee custom_json spotter")
    parser.add_argument(
        "--api-endpoint",
        default=os.environ.get("HIVE_API_HOST", "https://api.hive.blog/"),
        help="Hive API endpoint",
    )
    args = parser.parse_args()

    async with (
        create_hive_chain(WaxChainOptions(endpoint_url=args.api_endpoint)) as chain,
        WorkerBee(chain) as bot,
    ):
        async for block in bot:
            for tx_data in block["transactions"]:
                transaction = tx_data["transaction"]
                if any(op.type == "custom_json_operation" for op in transaction.operations):
                    print(transaction)


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(main())
