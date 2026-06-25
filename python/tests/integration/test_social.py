"""Mirrornet-backed integration tests for social/content observer hooks.

The ranges and expectations mirror the deterministic TypeScript bot-events
tests. They use historical replay against the configured mirrornet endpoint
instead of a local test node, so these tests do not depend on local hived tooling.
"""

from __future__ import annotations

import pytest

from tests.integration._mirrornet import MirrornetReplay


@pytest.mark.asyncio
async def test_on_votes_from_specific_account_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        97117000,
        97117025,
        lambda bot, _chain, got, on_error, on_complete: bot.on_votes("gtg").subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    votes = [
        f"Vote operation: {operation['voter']} voted for {operation['author']}/{operation['permlink']}"
        for note in notes
        for pair in note.get("votes", {}).get("gtg", [])
        for operation in [pair["operation"]]
    ]
    assert votes == ["Vote operation: gtg voted for hbd.funder/re-upvote-this-post-to-fund-hbdstabilizer-20250626t045515z"]


@pytest.mark.asyncio
async def test_on_posts_from_specific_author_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, got, on_error, on_complete: bot.on_posts("mtyszczak").subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    posts = [
        f"New post created: {operation['author']}/{operation['permlink']}"
        for note in notes
        for pair in note.get("posts", {}).get("mtyszczak", [])
        for operation in [pair["operation"]]
    ]
    assert posts == ["New post created: mtyszczak/hi-ve-everyone"]


@pytest.mark.asyncio
async def test_on_comments_from_specific_author_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        96549690,
        96549715,
        lambda bot, _chain, got, on_error, on_complete: bot.on_comments("gtg").subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    comments = [
        f"New comment created: {operation['author']}/{operation['permlink']}"
        for note in notes
        for pair in note.get("comments", {}).get("gtg", [])
        for operation in [pair["operation"]]
    ]
    assert comments == ["New comment created: gtg/re-mtyszczak-1749229740753"]


@pytest.mark.asyncio
async def test_on_custom_operation_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        97146305,
        97146312,
        lambda bot, _chain, got, on_error, on_complete: bot.on_custom_operation("follow").subscribe(
            on_next=got.append, on_error=on_error, on_complete=on_complete
        ),
    )

    custom_jsons = [pair["operation"]["json"] for note in notes for pair in note.get("custom_operations", {}).get("follow", [])]
    assert custom_jsons == [
        '["reblog",{"account":"marcocasario","author":"blitzzzz","permlink":"legacy-in-the-limelight-woo"}]',
        '["follow",{"follower":"badge-534654","following":"imfarhad","what":["blog"]}]',
        '["follow",{"follower":"fwaszkiewicz","following":"gtg","what":["blog"]}]',
    ]


@pytest.mark.asyncio
async def test_on_reblog_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        96839100,
        96839115,
        lambda bot, _chain, got, on_error, on_complete: bot.on_reblog("thebeedevs").subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    reblogs = [
        f"{operation['account']} reblogged: {operation['author']}/{operation['permlink']}"
        for note in notes
        for pair in note.get("reblogs", {}).get("thebeedevs", [])
        for operation in [pair["operation"]]
    ]
    assert reblogs == ["thebeedevs reblogged: mtyszczak/write-on-hive-read-everywhere"]


@pytest.mark.asyncio
async def test_on_follow_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        97146305,
        97146312,
        lambda bot, _chain, got, on_error, on_complete: bot.on_follow("fwaszkiewicz").subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    follows = [
        f"{operation['follower']} followed: {operation['following']}"
        for note in notes
        for pair in note.get("follows", {}).get("fwaszkiewicz", [])
        for operation in [pair["operation"]]
    ]
    assert follows == ["fwaszkiewicz followed: gtg"]


@pytest.mark.asyncio
async def test_on_mention_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        96812075,
        96812095,
        lambda bot, _chain, got, on_error, on_complete: bot.on_mention("gtg").subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    mentions = [
        f"gtg has been mentioned in post: {operation['author']}/{operation['permlink']}"
        for note in notes
        for operation in note.get("mentioned", {}).get("gtg", [])
    ]
    assert mentions == ["gtg has been mentioned in post: mtyszczak/write-on-hive-read-everywhere"]
