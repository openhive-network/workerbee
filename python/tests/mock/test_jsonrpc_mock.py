"""Recorded JSON-RPC mock integration tests."""

from __future__ import annotations

import pytest
from wax.interfaces import IHiveChainInterface

from tests.mock._js_mock_server import MAX_MOCK_NOTIFY_CYCLES, collect_until, drain_mock_notifications, with_js_mock_bot
from workerbee import WorkerBee
from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.payloads import ObserverNotification

pytestmark = pytest.mark.jsonrpc_mock


@pytest.mark.asyncio
async def test_recorded_jsonrpc_mock_drives_real_wax_chain(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """The Python JSON-RPC mock reuses TS logs and feeds the real Wax client."""
    bot = WorkerBee(js_jsonrpc_mock_chain)
    try:
        chain = bot.chain
        dgp = await chain.api.database_api.get_dynamic_global_properties()
        block = await chain.api.block_api.get_block(block_num=dgp.head_block_number)
        accounts = await chain.api.database_api.find_accounts(accounts=["gtg", "blocktrades", "thebeedevs"])
        rc_accounts = await chain.api.rc_api.find_rc_accounts(accounts=["gtg"])
        witnesses = await chain.api.database_api.find_witnesses(owners=["gtg"])
        feed_history = await chain.api.database_api.get_feed_history()
    finally:
        await bot.aclose()

    assert block.block.block_id == dgp.head_block_id
    assert [account.name for account in accounts.accounts] == ["gtg", "blocktrades", "thebeedevs"]
    assert [account.account for account in rc_accounts.rc_accounts] == ["gtg"]
    assert [witness.owner for witness in witnesses.witnesses] == ["gtg"]
    assert feed_history.current_median_history.base.amount


@pytest.mark.asyncio
async def test_recorded_jsonrpc_mock_supports_account_health_monitor(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of the TS recorded account-health scenario."""

    async def scenario(bot: WorkerBee) -> list[ObserverNotification]:
        def has_expected_account_data(received: list[ObserverNotification]) -> bool:
            if not received:
                return False
            account = received[-1]["accounts"].get("gtg")
            if account is None:
                return False
            return bool(account["json_metadata"]) and account["balance"]["HBD"]["savings"].amount == "3468"

        return await collect_until(
            bot,
            lambda received: (
                bot.observe.on_accounts_balance_change(False, "gtg")
                .or_.on_accounts_metadata_change("gtg")
                .or_.on_accounts_manabar_percent(ManabarType.UPVOTE, 100, "gtg")
                .provide_accounts("gtg")
                .subscribe(on_next=received.append)
            ),
            has_expected_account_data,
        )

    received = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert received
    account = received[-1]["accounts"]["gtg"]
    assert account is not None
    assert account["json_metadata"] == {
        "profile": {
            "about": "IT Wizard, Hive Witness",
            "location": "Hive",
            "name": "Gandalf the Grey",
            "profile_image": "https://grey.house/img/grey_4.jpg",
            "version": 2,
            "witness_description": "Gandalf the Grey, building Hive, improving Hive infrastructure.",
        },
    }
    assert account["balance"]["HBD"]["savings"].amount == "3468"


@pytest.mark.asyncio
async def test_recorded_jsonrpc_mock_supports_market_alert(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of the TS recorded market-alert scenario."""

    async def scenario(bot: WorkerBee) -> list[ObserverNotification]:
        return await collect_until(
            bot,
            lambda received: (
                bot.observe.on_feed_price_change(95)
                .or_.on_feed_price_no_change(1)
                .or_.on_witnesses_missed_blocks(5, "gtg")
                .provide_feed_price_data()
                .subscribe(on_next=received.append)
            ),
            bool,
        )

    received = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert received
    price_history = received[0]["feed_price"]["price_history"]
    price1 = int(price_history[0].base.amount) / int(price_history[0].quote.amount)
    price2 = int(price_history[1].base.amount) / int(price_history[1].quote.amount)
    percent_change = abs(price1 - price2) / price2 * 100
    assert percent_change == 134.30962343096238


@pytest.mark.asyncio
async def test_recorded_jsonrpc_mock_handles_duplicate_provider_calls(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Duplicate provider registrations are collapsed into one notification payload."""

    async def scenario(bot: WorkerBee) -> list[ObserverNotification]:
        return await collect_until(
            bot,
            lambda received: (
                bot.observe.on_block()
                .provide_accounts("gtg")
                .provide_accounts("gtg")
                .provide_accounts("gtg")
                .provide_accounts("gtg")
                .provide_manabar_data(ManabarType.RC, "gtg")
                .provide_manabar_data(ManabarType.RC, "gtg")
                .provide_manabar_data(ManabarType.RC, "gtg")
                .provide_block_data()
                .provide_block_data()
                .provide_block_data()
                .subscribe(on_next=received.append)
            ),
            bool,
        )

    received = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert received
    note = received[0]
    assert note["block"]["number"] == 97477291
    assert note["accounts"]["gtg"]["name"] == "gtg"
    assert note["manabar_data"]["gtg"][ManabarType.RC]["current_mana"] == 2152098568737624
    assert len(note["accounts"]) == 1
    assert len(note["manabar_data"]["gtg"]) == 1


@pytest.mark.asyncio
async def test_recorded_jsonrpc_mock_cleans_up_many_subscriptions(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Port of the TS resource-cleanup stress scenario."""

    async def scenario(bot: WorkerBee) -> str:
        subscriptions = [bot.observe.on_posts(f"author{i}").or_.on_comments(f"author{i}").provide_accounts(f"author{i}").subscribe() for i in range(100)]
        assert bot.mediator.has_listeners
        for subscription in subscriptions:
            subscription.close()
        assert not bot.mediator.has_listeners
        return f"Unsubscribed {len(subscriptions)} observers"

    result = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert result == "Unsubscribed 100 observers"


@pytest.mark.asyncio
async def test_recorded_jsonrpc_mock_runs_concurrent_observers(js_jsonrpc_mock_chain: IHiveChainInterface) -> None:
    """Independent observers can all resolve from the same recorded notify cycle."""

    async def scenario(bot: WorkerBee) -> int:
        posts: list[ObserverNotification] = []
        comments: list[ObserverNotification] = []
        votes: list[ObserverNotification] = []
        subscriptions = [
            bot.observe.on_posts("mtyszczak").provide_accounts("mtyszczak").subscribe(on_next=posts.append),
            bot.observe.on_comments("fwaszkiewicz").provide_accounts("fwaszkiewicz").subscribe(on_next=comments.append),
            bot.observe.on_votes("gtg").provide_manabar_data(ManabarType.RC, "gtg").subscribe(on_next=votes.append),
        ]
        try:
            for _ in range(MAX_MOCK_NOTIFY_CYCLES):
                await bot.mediator.notify()
                await drain_mock_notifications(bot)
                if posts and comments and votes:
                    break
        finally:
            for subscription in subscriptions:
                subscription.close()
        return sum(bool(group) for group in (posts, comments, votes))

    completed = await with_js_mock_bot(js_jsonrpc_mock_chain, scenario)

    assert completed == 3
