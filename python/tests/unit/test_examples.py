"""Tests for Python example-specific behavior."""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING, Protocol, cast

import pytest

from examples import post_observer

if TYPE_CHECKING:
    from beekeepy import AsyncUnlockedWallet

    from workerbee import WorkerBee


class VoteOperation(Protocol):
    voter: str
    author: str
    permlink: str
    weight: int


@pytest.fixture(autouse=True)
def clear_post_observer_state() -> Iterator[None]:
    post_observer.posts.clear()
    post_observer.voted.clear()
    yield
    post_observer.posts.clear()
    post_observer.voted.clear()


class FakePostTransaction:
    def __init__(self) -> None:
        self.events: list[str] = []
        self.operations: list[VoteOperation] = []
        self.signed_with: tuple[AsyncUnlockedWallet, str] | None = None

    def push_operation(self, operation: VoteOperation) -> None:
        self.events.append("push")
        self.operations.append(operation)

    async def sign(self, wallet: AsyncUnlockedWallet, public_key: str) -> None:
        self.events.append("sign")
        self.signed_with = (wallet, public_key)


class FakePostChain:
    def __init__(self, transaction: FakePostTransaction) -> None:
        self._transaction = transaction

    async def create_transaction(self) -> FakePostTransaction:
        return self._transaction


class FakePostBot:
    def __init__(self, transaction: FakePostTransaction) -> None:
        self.chain = FakePostChain(transaction)
        self._transaction = transaction
        self.broadcasted: list[FakePostTransaction] = []

    async def broadcast(self, transaction: FakePostTransaction) -> None:
        self._transaction.events.append("broadcast")
        self.broadcasted.append(transaction)


class TestPostObserverExample:
    @pytest.mark.asyncio
    async def test_vote_without_signing_context_skips_broadcast(self, capsys: pytest.CaptureFixture[str]) -> None:
        transaction = FakePostTransaction()
        bot = FakePostBot(transaction)

        await post_observer.vote(cast("WorkerBee", bot), None, "voter", "author", "permlink")

        output = capsys.readouterr().out
        assert "provide --private-key or HIVE_PRIVATE_KEY" in output
        assert "Vote error" not in output
        assert transaction.events == []
        assert transaction.operations == []
        assert bot.broadcasted == []
        assert post_observer.voted == set()

    @pytest.mark.asyncio
    async def test_vote_signs_before_broadcast(self) -> None:
        transaction = FakePostTransaction()
        bot = FakePostBot(transaction)
        wallet = cast("AsyncUnlockedWallet", object())

        await post_observer.vote(cast("WorkerBee", bot), (wallet, "public-key"), "voter", "author", "permlink")

        assert transaction.events == ["push", "sign", "broadcast"]
        assert len(transaction.operations) == 1
        operation = transaction.operations[0]
        assert operation.voter == "voter"
        assert operation.author == "author"
        assert operation.permlink == "permlink"
        assert operation.weight == 1000
        assert transaction.signed_with == (wallet, "public-key")
        assert bot.broadcasted == [transaction]
        assert post_observer.voted == {"author/permlink"}
