"""Mirrornet-backed integration tests aligned with TS realistic scenarios."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from tests.integration._asset_assertions import HiveAsset, asset_amount_value, hive_threshold, ts_raw_asset_is_greater_than
from tests.integration._mirrornet import MirrornetReplay

if TYPE_CHECKING:
    from workerbee.chain_observers.payloads import ObserverNotification


def _append_posts(payload: ObserverNotification, content: list[str], *, prefix: str = "") -> None:
    for entries in payload.get("posts", {}).values():
        for pair in entries:
            operation = pair["operation"]
            content.append(f"{prefix}{operation['author']} - {operation['permlink']}")


def _append_comments(payload: ObserverNotification, content: list[str], *, prefix: str = "") -> None:
    for entries in payload.get("comments", {}).values():
        for pair in entries:
            operation = pair["operation"]
            content.append(f"{prefix}{operation['author']} - {operation['permlink']}")


def _append_votes(payload: ObserverNotification, content: list[str], *, prefix: str = "Vote: ") -> None:
    for entries in payload.get("votes", {}).values():
        for pair in entries:
            operation = pair["operation"]
            content.append(f"{prefix}{operation['voter']} - {operation['permlink']}")


def _append_follows(payload: ObserverNotification, content: list[str], *, prefix: str = "Follow: ") -> None:
    for entries in payload.get("follows", {}).values():
        for pair in entries:
            operation = pair["operation"]
            content.append(f"{prefix}{operation['follower']} - {operation['following']}")


def _append_reblogs(payload: ObserverNotification, content: list[str], *, prefix: str = "Reblog: ") -> None:
    for entries in payload.get("reblogs", {}).values():
        for pair in entries:
            operation = pair["operation"]
            content.append(f"{prefix}{operation['author']} - {operation['permlink']}")


def _append_mentions(payload: ObserverNotification, content: list[str]) -> None:
    for entries in payload.get("mentioned", {}).values():
        for operation in entries:
            content.append(f"Mention: {operation['author']} - {operation['permlink']}")


def _append_custom(payload: ObserverNotification, content: list[str], op_id: str, *, prefix: str) -> None:
    for pair in payload.get("custom_operations", {}).get(op_id, []):
        content.append(f"{prefix}{pair['operation']['json']}")


def _append_new_accounts(payload: ObserverNotification, content: list[str]) -> None:
    for operation in payload.get("new_accounts", []):
        content.append(f"New Account: {operation['account_name']}")


def _append_posts_and_comments(payload: ObserverNotification, content: list[str]) -> None:
    _append_posts(payload, content)
    _append_comments(payload, content)


def _append_votes_follows_reblogs(payload: ObserverNotification, content: list[str]) -> None:
    _append_votes(payload, content)
    _append_follows(payload, content)
    _append_reblogs(payload, content)


def _append_content_engagement(payload: ObserverNotification, content: list[str]) -> None:
    _append_posts(payload, content, prefix="Post: ")
    _append_mentions(payload, content)
    _append_reblogs(payload, content)


def _append_cross_platform_activity(payload: ObserverNotification, content: list[str]) -> None:
    _append_custom(payload, content, "follow", prefix="Follow: ")
    _append_custom(payload, content, "reblog", prefix="Reblog: ")
    _append_new_accounts(payload, content)


def _append_creator_dashboard(payload: ObserverNotification, content: list[str]) -> None:
    _append_posts(payload, content, prefix="Post: ")
    _append_comments(payload, content, prefix="Comment: ")
    _append_mentions(payload, content)
    _append_reblogs(payload, content)
    _append_votes(payload, content)


def _append_votes_and_posts(payload: ObserverNotification, content: list[str]) -> None:
    _append_votes(payload, content)
    _append_posts(payload, content, prefix="Post: ")


def _append_community_growth(payload: ObserverNotification, content: list[str]) -> None:
    _append_new_accounts(payload, content)
    _append_follows(payload, content, prefix="Follow: ")
    _append_custom(payload, content, "follow", prefix="Custom Follow: ")


def _append_content_performance(payload: ObserverNotification, content: list[str]) -> None:
    _append_posts(payload, content, prefix="Post: ")
    _append_comments(payload, content, prefix="Comment: ")
    _append_votes(payload, content)


def _append_account_behavior(payload: ObserverNotification, content: list[str]) -> None:
    _append_posts(payload, content, prefix="Post: ")
    _append_votes(payload, content)
    _append_follows(payload, content)
    _append_reblogs(payload, content)


def _append_finance(
    payload: ObserverNotification,
    content: list[str],
    *,
    whale_prefix: str,
    market_prefix: str,
    exchange_prefix: str | None = None,
    whale_threshold: HiveAsset | None = None,
    order: tuple[str, ...] = ("exchange", "market", "whale"),
) -> None:
    def append_exchange() -> None:
        if exchange_prefix is None:
            return
        for pair in payload.get("exchange_transfer_operations", []):
            operation = pair["operation"]
            content.append(f"{exchange_prefix}{operation['from']} -> {operation['to']} - {asset_amount_value(operation['amount'])}")

    def append_market() -> None:
        for pair in payload.get("internal_market_operations", []):
            operation = pair["operation"]
            content.append(f"{market_prefix}{operation['owner']} - {operation['order_id']}")

    def append_whale() -> None:
        for pair in payload.get("whale_operations", []):
            operation = pair["operation"]
            if whale_threshold is not None:
                assert ts_raw_asset_is_greater_than(whale_threshold, operation["amount"])
            content.append(f"{whale_prefix}{operation['from']} -> {operation['to']} - {asset_amount_value(operation['amount'])}")

    appenders = {
        "exchange": append_exchange,
        "market": append_market,
        "whale": append_whale,
    }
    for name in order:
        appenders[name]()


@pytest.mark.asyncio
async def test_posts_or_comments_from_multiple_authors_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        96549390,
        96549415,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("mtyszczak")
        .on_posts("nickdongsik")
        .on_comments("brando28")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_posts_and_comments(payload, content),
        ),
    )

    # TS currently omits the final matching comment in this closed replay
    # window. Python keeps the replay inclusive and asserts the emitted event.
    assert result == [
        "brando28 - re-bitcoinman-ovjhawi6",
        "mtyszczak - hi-ve-everyone",
        "nickdongsik - yay-hb1hao",
        "brando28 - re-carephree-38kjncdis",
    ]


@pytest.mark.asyncio
async def test_social_activity_aggregator_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97146285,
        97146300,
        lambda bot, _chain, content, on_error, on_complete: bot.on_votes("e-sport-gamer")
        .on_follow("fwaszkiewicz")
        .on_reblog("maxinpower")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_votes_follows_reblogs(payload, content),
        ),
    )

    # TS currently stops before the final matching vote in this closed replay
    # window. Python keeps the replay inclusive and asserts the emitted event.
    assert result == [
        "Vote: e-sport-gamer - city-pingeons",
        "Follow: fwaszkiewicz - thebeedevs",
        "Follow: fwaszkiewicz - thebeedevs",
        "Reblog: maxinpower - erinnnerungen-an-eine-gute-currywurst-berlin-impressions",
        "Vote: e-sport-gamer - my-school-of-life-eng",
    ]


@pytest.mark.asyncio
async def test_financial_activity_monitor_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    whale_threshold = hive_threshold(50)
    result: list[str] = await mirrornet_replay(
        97347575,
        97347585,
        lambda bot, _chain, content, on_error, on_complete: bot.on_whale_alert(whale_threshold)
        .on_internal_market_operation()
        .on_exchange_transfer()
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_finance(
                payload,
                content,
                whale_prefix="Whale Alert: ",
                market_prefix="Internal Market Operation: ",
                exchange_prefix="Exchange Transfer: ",
                whale_threshold=whale_threshold,
            ),
        ),
    )

    assert result == [
        "Internal Market Operation: honeybot - 243293707",
        "Whale Alert: honey-swap -> luluwinda - 53308",
        "Internal Market Operation: honeybot - 1485200410",
        "Exchange Transfer: mxchive -> inhivepool - 23890",
    ]


@pytest.mark.asyncio
async def test_content_engagement_tracker_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97639665,
        97639695,
        lambda bot, _chain, content, on_error, on_complete: bot.on_mention("thebeedevs")
        .on_posts("thebeedevs")
        .on_reblog("thebeedevs")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_content_engagement(payload, content),
        ),
    )

    assert result == [
        "Post: thebeedevs - hivesense-why-nothing-worked-at-first-and-what-we-did-about-it",
        "Mention: thebeedevs - hivesense-why-nothing-worked-at-first-and-what-we-did-about-it",
        "Reblog: thebeedevs - hivesense-why-nothing-worked-at-first-and-what-we-did-about-it",
    ]


@pytest.mark.asyncio
async def test_cross_platform_activity_monitor_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97664614,
        97664618,
        lambda bot, _chain, content, on_error, on_complete: bot.on_custom_operation("follow")
        .on_custom_operation("reblog")
        .on_new_account()
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_cross_platform_activity(payload, content),
        ),
    )

    assert result == [
        'Follow: ["reblog",{"account":"cribbio","author":"donasycafe","permlink":"feliz-4o-aniversario-mi-historia"}]',
        'Follow: ["reblog",{"account":"gasaeightyfive","author":"donasycafe","permlink":"feliz-4o-aniversario-mi-historia"}]',
        'Reblog: ["reblog",{"account":"dehai","author":"rubenjr","permlink":"hello-its-me-what-can-a-father-do"}]',
        "New Account: ayasolene20",
    ]


@pytest.mark.asyncio
async def test_content_creator_dashboard_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97547200,
        97547250,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("thebeedevs")
        .on_comments("thebeedevs")
        .on_mention("thebeedevs")
        .on_reblog("thebeedevs")
        .on_votes(
            "thebeedevs",
        )
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_creator_dashboard(payload, content),
        ),
    )

    assert result == [
        "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Mention: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Reblog: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
    ]


@pytest.mark.asyncio
async def test_market_movement_detector_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    whale_threshold = hive_threshold(10000)
    result: list[str] = await mirrornet_replay(
        97347545,
        97347555,
        lambda bot, _chain, content, on_error, on_complete: bot.on_whale_alert(whale_threshold)
        .on_internal_market_operation()
        .on_exchange_transfer()
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_finance(
                payload,
                content,
                whale_prefix="Whale Alert: ",
                market_prefix="Internal Market Operation: ",
                exchange_prefix="Exchange Transfer: ",
                whale_threshold=whale_threshold,
                order=("whale", "market", "exchange"),
            ),
        ),
    )

    assert result == [
        "Whale Alert: huobi-pro -> huobi-withdrawal - 1598290",
        "Exchange Transfer: huobi-pro -> huobi-withdrawal - 1598290",
        "Whale Alert: aerrilee -> checkyzk - 2",
        "Internal Market Operation: daverick - 1751626472",
    ]


@pytest.mark.asyncio
async def test_pattern_analysis_bot_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97547200,
        97547250,
        lambda bot, _chain, content, on_error, on_complete: bot.on_votes("thebeedevs")
        .on_posts("thebeedevs")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_votes_and_posts(payload, content),
        ),
    )

    assert result == [
        "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
    ]


@pytest.mark.asyncio
async def test_market_trend_analyzer_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    whale_threshold = hive_threshold(10000)
    result: list[str] = await mirrornet_replay(
        97347545,
        97347555,
        lambda bot, _chain, content, on_error, on_complete: bot.on_whale_alert(whale_threshold)
        .on_internal_market_operation()
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_finance(
                payload,
                content,
                whale_prefix="Whale Alert: ",
                market_prefix="Internal Market: ",
                whale_threshold=whale_threshold,
            ),
        ),
    )

    assert result == [
        "Whale Alert: huobi-pro -> huobi-withdrawal - 1598290",
        "Whale Alert: aerrilee -> checkyzk - 2",
        "Internal Market: daverick - 1751626472",
    ]


@pytest.mark.asyncio
async def test_community_growth_monitor_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97664610,
        97664620,
        lambda bot, _chain, content, on_error, on_complete: bot.on_new_account()
        .on_follow("thebeedevs")
        .on_custom_operation("follow")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_community_growth(payload, content),
        ),
    )

    assert result == [
        'Custom Follow: ["follow",{"follower":"dehai","following":"rubenjr","what":["blog"]}]',
        'Custom Follow: ["follow",{"follower":"dehai","following":"rubenjr","what":[]}]',
        'Custom Follow: ["follow",{"follower":"dehai","following":"rubenjr","what":["blog"]}]',
        'Custom Follow: ["reblog",{"account":"cribbio","author":"donasycafe","permlink":"feliz-4o-aniversario-mi-historia"}]',
        "New Account: ayasolene20",
        'Custom Follow: ["reblog",{"account":"gasaeightyfive","author":"donasycafe","permlink":"feliz-4o-aniversario-mi-historia"}]',
    ]


@pytest.mark.asyncio
async def test_content_performance_analyzer_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97547200,
        97547250,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("thebeedevs")
        .on_comments("thebeedevs")
        .on_votes("thebeedevs")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_content_performance(payload, content),
        ),
    )

    assert result == [
        "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
    ]


@pytest.mark.asyncio
async def test_economic_activity_tracker_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    whale_threshold = hive_threshold(1000)
    result: list[str] = await mirrornet_replay(
        97347575,
        97347585,
        lambda bot, _chain, content, on_error, on_complete: bot.on_whale_alert(whale_threshold)
        .on_exchange_transfer()
        .on_internal_market_operation()
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_finance(
                payload,
                content,
                whale_prefix="Whale: ",
                market_prefix="Market: ",
                exchange_prefix="Exchange: ",
                whale_threshold=whale_threshold,
                order=("whale", "exchange", "market"),
            ),
        ),
    )

    assert result == [
        "Whale: honey-swap -> hive-engine - 403",
        "Whale: honey-swap -> luluwinda - 53308",
        "Market: honeybot - 243293707",
        "Market: honeybot - 1485200410",
        "Whale: mxchive -> inhivepool - 23890",
        "Exchange: mxchive -> inhivepool - 23890",
    ]


@pytest.mark.asyncio
async def test_account_behavior_analysis_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    result: list[str] = await mirrornet_replay(
        97547200,
        97547250,
        lambda bot, _chain, content, on_error, on_complete: bot.on_posts("thebeedevs")
        .on_votes("thebeedevs")
        .on_follow("thebeedevs")
        .on_reblog("thebeedevs")
        .subscribe(
            on_error=on_error,
            on_complete=on_complete,
            on_next=lambda payload: _append_account_behavior(payload, content),
        ),
    )

    assert result == [
        "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
        "Reblog: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
    ]
