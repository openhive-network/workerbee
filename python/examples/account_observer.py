"""Account observer example — Python port of examples/account-observer/index.html.

Monitors all operations impacting a given account and logs them.

Usage:
    python -m examples.account_observer [--account NAME] [--api-endpoint URL]
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import os

from wax import WaxChainOptions, create_hive_chain

from workerbee import WorkerBee


async def main() -> None:
    parser = argparse.ArgumentParser(description="WorkerBee Account observer example")
    parser.add_argument(
        "--account",
        default="initminer",
        help="Account to observe",
    )
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
        account_to_observe = args.account
        print(f"Observing account: {account_to_observe!r}")

        # Observer chains are async-iterable: events stream in via ``async for``
        # and pipeline errors raise out of the loop.
        async for event in bot.observe.on_impacted_accounts(account_to_observe):
            print(json.dumps(event, indent=2, default=str))


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(main())
