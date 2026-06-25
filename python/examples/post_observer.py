"""Post observer example — Python port of examples/post-observer/index.html.

Monitors an account for impacted operations, tracks new posts with full
beneficiary settings, and votes on them once manabar is full.

Usage:
    python -m examples.post_observer \
        --account initminer \
        --beneficiary initminer \
        --voter voter \
        [--api-endpoint URL] [--chain-id ID] [--private-key KEY]
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import os
import time
import uuid
from collections.abc import AsyncIterator
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING, TypedDict

from beekeepy import AsyncBeekeeper
from beekeepy._interface.settings import InterfaceSettings
from wax import WaxChainOptions, create_hive_chain
from wax.proto.operations import vote as vote_operation

from workerbee import ManabarType, ObserverNotification, WorkerBee

if TYPE_CHECKING:
    from beekeepy import AsyncUnlockedWallet

# An op body (op.value) is a raw, undecoded JSON object.
OperationValue = dict[str, object]
SigningContext = tuple["AsyncUnlockedWallet", str] | None


class PostEntry(TypedDict, total=False):
    """A tracked post: when it was seen and whether the beneficiary matched."""

    added: float
    beneficiary_matched: bool


DAY_S = 24 * 60 * 60

voted: set[str] = set()
posts: dict[str, PostEntry] = {}


def get_key(op: OperationValue) -> str:
    author = op.get("account") or op.get("author", "")
    permlink = op.get("permlink", "")
    return f"{author}/{permlink}"


@contextlib.asynccontextmanager
async def signing_wallet(private_key: str | None) -> AsyncIterator[SigningContext]:
    if not private_key:
        yield None
        return

    with TemporaryDirectory() as directory:
        settings = InterfaceSettings(working_directory=Path(directory))
        async with await AsyncBeekeeper.factory(settings=settings) as beekeeper:
            session = await beekeeper.create_session()
            wallet = await session.create_wallet(
                name=f"workerbee-example-{uuid.uuid4().hex}",
                password=uuid.uuid4().hex,
            )
            await wallet.import_key(private_key=private_key)
            public_key = (await wallet.public_keys)[0]
            yield wallet, public_key


async def vote(bot: WorkerBee, signing: SigningContext, voter: str, author: str, permlink: str) -> None:
    if signing is None:
        print("Vote skipped: provide --private-key or HIVE_PRIVATE_KEY to sign transactions")
        return

    wallet, public_key = signing
    try:
        tx = await bot.chain.create_transaction()
        tx.push_operation(
            vote_operation(
                voter=voter,
                author=author,
                permlink=permlink,
                weight=1000,
            ),
        )
        await tx.sign(wallet, public_key)
        await bot.broadcast(tx)
        voted.add(f"{author}/{permlink}")
        print(f"Vote broadcast for {author}/{permlink}")
    except Exception as exc:  # noqa: BLE001 - example logs vote/broadcast failures and keeps observing.
        print(f"Vote error: {exc}")


async def main() -> None:
    parser = argparse.ArgumentParser(description="WorkerBee Post observer example")
    parser.add_argument("--account", default="initminer", help="Account to observe")
    parser.add_argument("--beneficiary", default="initminer", help="Required beneficiary")
    parser.add_argument("--voter", default="voter", help="Voting account")
    parser.add_argument(
        "--api-endpoint",
        default=os.environ.get("DIRECT_API_ENDPOINT", "https://api.hive.blog/"),
        help="Hive API endpoint",
    )
    parser.add_argument(
        "--chain-id",
        default=os.environ.get("CHAIN_ID"),
        help="Chain ID",
    )
    parser.add_argument(
        "--private-key",
        default=os.environ.get("HIVE_PRIVATE_KEY"),
        help="Private key used to sign vote transactions; defaults to HIVE_PRIVATE_KEY",
    )
    args = parser.parse_args()

    opts = WaxChainOptions(endpoint_url=args.api_endpoint)
    if args.chain_id:
        opts.chain_id = args.chain_id

    async with create_hive_chain(opts) as chain, signing_wallet(args.private_key) as signing, WorkerBee(chain) as bot:
        account_to_observe = args.account
        beneficiary_name = args.beneficiary
        voter_name = args.voter

        print(f"Observing account posts: {account_to_observe!r}")

        def on_impacted(data: ObserverNotification) -> None:
            impacted = data.get("impacted_accounts", {})
            ops = impacted.get(account_to_observe, [])
            for pair in ops:
                op = pair["operation"]  # hf26 Operation struct: op.type / op.value
                op_type = op.type
                value = op.value

                if op_type == "comment_operation":
                    key = get_key(value)
                    print(f"Got new comment in block: {key!r}")
                    if key not in voted:
                        posts[key] = {"added": time.time()}

                elif op_type == "comment_options_operation":
                    for ext in value.get("extensions", []):
                        for b in ext.get("comment_payout_beneficiaries", {}).get("beneficiaries", []):
                            if b.get("account") == beneficiary_name and b.get("weight", 0) >= 10000:
                                key = get_key(value)
                                post = posts.get(key)
                                if post is not None:
                                    post["beneficiary_matched"] = True
                                    print(f"Full beneficiary set on comment {key!r}: {b['account']!r}")

        def on_impacted_error(error: BaseException) -> None:
            print(f"Error: {error}")

        bot.observe.on_impacted_accounts(account_to_observe).provide_block_header_data().subscribe(
            on_next=on_impacted,
            on_error=on_impacted_error,
        )

        # Async callbacks are first-class: await the vote directly instead of
        # firing it off with ensure_future (which would drop errors/ordering).
        async def on_full_manabar(data: ObserverNotification) -> None:
            if not posts:
                return
            key = next(iter(posts))
            post = posts[key]
            print(f"Full manabar — trying to vote for {key!r}")
            author, permlink = key.split("/")
            if post.get("beneficiary_matched") and (time.time() - post["added"]) <= DAY_S:
                del posts[key]
                await vote(bot, signing, voter_name, author, permlink)
            else:
                print(f"Properties for post {key!r} not sufficient")

        def on_mana_error(error: BaseException) -> None:
            print(f"Manabar error: {error}")

        bot.observe.on_accounts_full_manabar(ManabarType.UPVOTE, account_to_observe).subscribe(
            on_next=on_full_manabar,
            on_error=on_mana_error,
        )

        # Keep the process alive while both subscriptions stream events.
        await bot.run_forever()


if __name__ == "__main__":
    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(main())
