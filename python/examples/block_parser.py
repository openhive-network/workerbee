"""Block parser example — Python port of examples/block-parser/index.html.

Iterates over live blocks using ``async for`` and logs block id + number.

Usage:
    python -m examples.block_parser [--api-endpoint URL]
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import os

from wax import WaxChainOptions, create_hive_chain

from workerbee import WorkerBee


async def main() -> None:
    parser = argparse.ArgumentParser(description="WorkerBee Block parser example")
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
            print(f"Got block #{block['id']} ({block['number']})")


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(main())
