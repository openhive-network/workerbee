"""Mirrornet replay equivalents of TypeScript individual filter tests."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from tests.integration._mirrornet import MirrornetReplay

if TYPE_CHECKING:
    from workerbee.chain_observers.interfaces import CompleteCallback, ErrorCallback
    from workerbee.chain_observers.past_queen import PastQueen
    from workerbee.chain_observers.payloads import ObserverNotification
    from workerbee.chain_observers.queen import Subscription


def _append_posts(note: ObserverNotification, authors: list[str], target: list[str]) -> None:
    for author in authors:
        for pair in note.get("posts", {}).get(author, []):
            operation = pair["operation"]
            target.append(f"Post by {operation['author']}: {operation['permlink']}")


def _append_comments(note: ObserverNotification, authors: list[str], target: list[str]) -> None:
    for author in authors:
        for pair in note.get("comments", {}).get(author, []):
            operation = pair["operation"]
            target.append(f"Comment by {operation['author']}: {operation['permlink']}")


def _append_votes(note: ObserverNotification, voters: list[str], target: list[str]) -> None:
    for voter in voters:
        for pair in note.get("votes", {}).get(voter, []):
            operation = pair["operation"]
            target.append(f"Vote by {operation['voter']} on {operation['author']}/{operation['permlink']}")


def _block_number(note: ObserverNotification) -> int:
    block = note.get("block", {})
    number = block.get("number") if isinstance(block, dict) else None
    assert isinstance(number, int)
    return number


@pytest.mark.asyncio
async def test_posts_from_any_specified_account(mirrornet_replay: MirrornetReplay) -> None:
    authors = ["mtyszczak", "author2", "author3"]

    def register(bot: PastQueen, _chain: object, content: list[str], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return bot.on_posts(*authors).subscribe(
            on_next=lambda note: _append_posts(note, authors, content),
            on_error=on_error,
            on_complete=on_complete,
        )

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == ["Post by mtyszczak: hi-ve-everyone"]


@pytest.mark.asyncio
async def test_simultaneous_posts_from_multiple_accounts_same_block(mirrornet_replay: MirrornetReplay) -> None:
    authors = ["comandoyeya", "daddydog"]

    def on_next(note: ObserverNotification, rows: list[dict[str, int | str]]) -> None:
        for author in authors:
            for pair in note.get("posts", {}).get(author, []):
                rows.append({"author": pair["operation"]["author"], "block_number": _block_number(note)})

    def register(bot: PastQueen, _chain: object, rows: list[dict[str, int | str]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return (
            bot.on_block()
            .on_posts(*authors)
            .subscribe(
                on_next=lambda note: on_next(note, rows),
                on_error=on_error,
                on_complete=on_complete,
            )
        )

    result = await mirrornet_replay(97632050, 97632075, register)

    assert result == [
        {"author": "comandoyeya", "block_number": 97632067},
        {"author": "daddydog", "block_number": 97632067},
    ]


@pytest.mark.asyncio
async def test_posts_ignore_comments_from_same_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"posts": 0, "comments": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            totals["posts"] += len(note.get("posts", {}).get("gtg", []))
            totals["comments"] += len(note.get("comments", {}).get("gtg", []))

        return bot.on_posts("gtg").on_comments("gtg").subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549690, 96549715, register)

    assert result == [{"posts": 0, "comments": 1}]


@pytest.mark.asyncio
async def test_posts_ignore_comments_from_multiple_accounts(mirrornet_replay: MirrornetReplay) -> None:
    accounts = ["gtg", "moretea", "khantaimur"]

    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"posts": 0, "comments": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            for account in accounts:
                totals["posts"] += len(note.get("posts", {}).get(account, []))
                totals["comments"] += len(note.get("comments", {}).get(account, []))

        return bot.on_posts(*accounts).on_comments(*accounts).subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549690, 96549715, register)

    assert result == [{"posts": 0, "comments": 3}]


@pytest.mark.asyncio
async def test_posts_ignore_different_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"monitored": 0, "other": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            totals["monitored"] += len(note.get("posts", {}).get("nonexistent-account", []))
            totals["other"] += len(note.get("posts", {}).get("mtyszczak", []))

        return bot.on_posts("nonexistent-account").on_posts("mtyszczak").subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == [{"monitored": 0, "other": 1}]


@pytest.mark.asyncio
async def test_posts_empty_account_list_does_not_emit(mirrornet_replay: MirrornetReplay) -> None:
    result = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, rows, on_error, on_complete: bot.on_posts().subscribe(on_next=rows.append, on_error=on_error, on_complete=on_complete),
    )

    assert result == []


@pytest.mark.asyncio
async def test_comments_from_any_specified_account(mirrornet_replay: MirrornetReplay) -> None:
    authors = ["gtg", "moretea", "khantaimur"]

    def register(bot: PastQueen, _chain: object, content: list[str], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return bot.on_comments(*authors).subscribe(
            on_next=lambda note: _append_comments(note, authors, content),
            on_error=on_error,
            on_complete=on_complete,
        )

    result = await mirrornet_replay(96549690, 96549715, register)

    assert result == [
        "Comment by moretea: re-leothreads-2xpn8nyzd",
        "Comment by khantaimur: re-vkcmjbdble",
        "Comment by gtg: re-mtyszczak-1749229740753",
    ]


@pytest.mark.asyncio
async def test_simultaneous_comments_from_multiple_accounts_same_block(mirrornet_replay: MirrornetReplay) -> None:
    authors = ["zayyar99", "beckyroyal"]

    def on_next(note: ObserverNotification, rows: list[dict[str, int | str]]) -> None:
        for author in authors:
            for pair in note.get("comments", {}).get(author, []):
                rows.append({"author": pair["operation"]["author"], "block_number": _block_number(note)})

    def register(bot: PastQueen, _chain: object, rows: list[dict[str, int | str]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return (
            bot.on_block()
            .on_comments(*authors)
            .subscribe(
                on_next=lambda note: on_next(note, rows),
                on_error=on_error,
                on_complete=on_complete,
            )
        )

    result = await mirrornet_replay(97634334, 97634348, register)

    assert result == [
        {"author": "zayyar99", "block_number": 97634338},
        {"author": "beckyroyal", "block_number": 97634338},
    ]


@pytest.mark.asyncio
async def test_comments_ignore_posts_from_same_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"comments": 0, "posts": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            totals["comments"] += len(note.get("comments", {}).get("mtyszczak", []))
            totals["posts"] += len(note.get("posts", {}).get("mtyszczak", []))

        return bot.on_comments("mtyszczak").on_posts("mtyszczak").subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == [{"comments": 0, "posts": 1}]


@pytest.mark.asyncio
async def test_comments_ignore_posts_from_multiple_accounts(mirrornet_replay: MirrornetReplay) -> None:
    accounts = ["mtyszczak", "nickdongsik", "techstyle"]

    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"comments": 0, "posts": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            for account in accounts:
                totals["comments"] += len(note.get("comments", {}).get(account, []))
                totals["posts"] += len(note.get("posts", {}).get(account, []))

        return bot.on_comments(*accounts).on_posts(*accounts).subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result[0]["comments"] == 0
    assert result[0]["posts"] > 0


@pytest.mark.asyncio
async def test_comments_ignore_different_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"monitored": 0, "other": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            totals["monitored"] += len(note.get("comments", {}).get("nonexistent-commenter", []))
            totals["other"] += len(note.get("comments", {}).get("gtg", []))

        return bot.on_comments("nonexistent-commenter").on_comments("gtg").subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549690, 96549715, register)

    assert result == [{"monitored": 0, "other": 1}]


@pytest.mark.asyncio
async def test_comments_empty_account_list_does_not_emit(mirrornet_replay: MirrornetReplay) -> None:
    result = await mirrornet_replay(
        96549690,
        96549715,
        lambda bot, _chain, rows, on_error, on_complete: bot.on_comments().subscribe(on_next=rows.append, on_error=on_error, on_complete=on_complete),
    )

    assert result == []


@pytest.mark.asyncio
async def test_posts_or_comments_from_any_specified_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, content: list[str], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        def on_next(note: ObserverNotification) -> None:
            _append_comments(note, ["secret-art", "author2", "author3"], content)
            _append_posts(note, ["mtyszczak", "author2", "author3"], content)

        return (
            bot.on_posts("mtyszczak", "author2", "author3")
            .on_comments("secret-art", "author2", "author3")
            .subscribe(
                on_next=on_next,
                on_error=on_error,
                on_complete=on_complete,
            )
        )

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == [
        "Comment by secret-art: re-jfang003-sxg1lb",
        "Comment by secret-art: re-aussieninja-sxg1lm",
        "Post by mtyszczak: hi-ve-everyone",
        "Comment by secret-art: re-aussieninja-sxg1m5",
        "Comment by secret-art: re-jfang003-sxg1mg",
    ]


@pytest.mark.asyncio
async def test_votes_from_any_specified_account(mirrornet_replay: MirrornetReplay) -> None:
    voters = ["dhedge", "winanda"]

    def register(bot: PastQueen, _chain: object, content: list[str], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return bot.on_votes(*voters).subscribe(
            on_next=lambda note: _append_votes(note, voters, content),
            on_error=on_error,
            on_complete=on_complete,
        )

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == [
        "Vote by winanda on xlety/is-it-really-worth-creating",
        "Vote by dhedge on gpache/i-went-to-a-doctors-office-my-vision-is-improving-eng-esp",
        "Vote by dhedge on helicreamarket/sorpresa-al-horno-esp-eng",
    ]


@pytest.mark.asyncio
async def test_simultaneous_votes_from_multiple_accounts_same_block(mirrornet_replay: MirrornetReplay) -> None:
    voters = ["noctury", "the-burn"]

    def on_next(note: ObserverNotification, rows: list[dict[str, int | str]]) -> None:
        for voter in voters:
            for pair in note.get("votes", {}).get(voter, []):
                rows.append({"voter": pair["operation"]["voter"], "block_number": _block_number(note)})

    def register(bot: PastQueen, _chain: object, rows: list[dict[str, int | str]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return (
            bot.on_block()
            .on_votes(*voters)
            .subscribe(
                on_next=lambda note: on_next(note, rows),
                on_error=on_error,
                on_complete=on_complete,
            )
        )

    result = await mirrornet_replay(96549390, 96549404, register)

    assert result == [
        {"voter": "noctury", "block_number": 96549403},
        {"voter": "the-burn", "block_number": 96549403},
    ]


@pytest.mark.asyncio
async def test_votes_ignore_posts_and_comments_from_same_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"votes": 0, "content": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            totals["votes"] += len(note.get("votes", {}).get("mtyszczak", []))
            totals["content"] += len(note.get("comments", {}).get("mtyszczak", []))
            totals["content"] += len(note.get("posts", {}).get("mtyszczak", []))

        return (
            bot.on_votes("mtyszczak")
            .on_posts("mtyszczak")
            .on_comments("mtyszczak")
            .subscribe(
                on_next=on_next,
                on_error=on_error,
                on_complete=on_complete,
            )
        )

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == [{"votes": 0, "content": 1}]


@pytest.mark.asyncio
async def test_votes_ignore_different_account(mirrornet_replay: MirrornetReplay) -> None:
    def register(bot: PastQueen, _chain: object, counts: list[dict[str, int]], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        totals = {"monitored": 0, "other": 0}
        counts.append(totals)

        def on_next(note: ObserverNotification) -> None:
            totals["monitored"] += len(note.get("votes", {}).get("nonexistent-voter", []))
            totals["other"] += len(note.get("votes", {}).get("noctury", []))

        return bot.on_votes("nonexistent-voter").on_votes("noctury").subscribe(on_next=on_next, on_error=on_error, on_complete=on_complete)

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result[0]["monitored"] == 0
    assert result[0]["other"] > 0


@pytest.mark.asyncio
async def test_votes_empty_account_list_does_not_emit(mirrornet_replay: MirrornetReplay) -> None:
    result = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, rows, on_error, on_complete: bot.on_votes().subscribe(on_next=rows.append, on_error=on_error, on_complete=on_complete),
    )

    assert result == []


@pytest.mark.asyncio
async def test_multiple_and_filters_match_same_block(mirrornet_replay: MirrornetReplay) -> None:
    def on_next(note: ObserverNotification, content: list[str]) -> None:
        for author in ["mtyszczak", "jacor"]:
            for pair in note.get("posts", {}).get(author, []):
                operation = pair["operation"]
                content.append(f"Post by {operation['author']}: {operation['permlink']} in block {_block_number(note)}")

            for pair in note.get("votes", {}).get(author, []):
                operation = pair["operation"]
                content.append(f"Vote by {operation['voter']}: {operation['permlink']} in block {_block_number(note)}")

    def register(bot: PastQueen, _chain: object, content: list[str], on_error: ErrorCallback, on_complete: CompleteCallback) -> Subscription:
        return (
            bot.on_posts("mtyszczak")
            .and_.and_.and_.and_.and_.and_.on_votes("jacor")
            .provide_block_data()
            .subscribe(
                on_next=lambda note: on_next(note, content),
                on_error=on_error,
                on_complete=on_complete,
            )
        )

    result = await mirrornet_replay(96549390, 96549415, register)

    assert result == [
        "Post by mtyszczak: hi-ve-everyone in block 96549402",
        "Vote by jacor: i-went-to-a-doctors-office-my-vision-is-improving-eng-esp in block 96549402",
    ]
