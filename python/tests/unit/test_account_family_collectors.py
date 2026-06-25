"""AccountCollector / WitnessCollector / RcAccountCollector against real models.

These exercise the collectors' reshape against genuine ``hiveio_api`` structs
(built by ``tests/unit/_builders``), locking the typed AccountData/RcAccountData/
WitnessData payload shapes (``workerbee.chain_observers.payloads``) to what the
collectors actually emit.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.collector_classifier_base import TRegisterEvaluationContext
from workerbee.chain_observers.classifiers.rc_account_classifier import RcAccountClassifier
from workerbee.chain_observers.classifiers.witness_classifier import WitnessClassifier
from workerbee.chain_observers.collectors.jsonrpc.account_collector import AccountCollector
from workerbee.chain_observers.collectors.jsonrpc.rc_account_collector import RcAccountCollector
from workerbee.chain_observers.collectors.jsonrpc.witness_collector import WitnessCollector
from workerbee.chain_observers.enums import ManabarType
from workerbee.chain_observers.providers.account_provider import AccountProvider
from workerbee.chain_observers.providers.manabar_provider import ManabarProvider
from workerbee.chain_observers.providers.rc_account_provider import RcAccountProvider
from workerbee.chain_observers.providers.witness_provider import WitnessProvider

from ._builders import build_account, find_accounts_response
from .conftest import FakeWorker


class _TimingCtx:
    """Minimal collector evaluation context — only ``add_timing`` is used."""

    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        yield


class _ClassifierCtx:
    """Provider context returning a fixed classifier payload from ``get``."""

    def __init__(self, classifier: type, payload: dict[str, Any]) -> None:
        self._classifier = classifier
        self._payload = payload

    async def get(self, classifier: type) -> dict[str, Any]:
        return self._payload if classifier is self._classifier else {}


def _context_options(contexts: list[TRegisterEvaluationContext], key: str) -> list[object]:
    return [ctx["options"][key] for ctx in contexts if isinstance(ctx, dict)]


# ---------------------------------------------------------------------------
# AccountCollector
# ---------------------------------------------------------------------------


class TestAccountCollector:
    @pytest.mark.asyncio
    async def test_reshapes_real_account(self, mock_worker: FakeWorker) -> None:
        collector = AccountCollector(worker=mock_worker)
        collector.register({"account": "alice"})

        result = await collector.get(_TimingCtx())
        accounts = result[AccountClassifier.__name__]["accounts"]

        assert "alice" in accounts
        acc = accounts["alice"]
        assert acc["name"] == "alice"
        # The three balance buckets and their slots are present.
        assert set(acc["balance"]) == {"HBD", "HIVE", "HP"}
        assert set(acc["balance"]["HBD"]) == {"liquid", "savings", "unclaimed", "total"}
        assert set(acc["balance"]["HP"]) >= {"liquid", "delegated", "received", "powering_down", "total"}
        # Balance leaves are real hiveio_api asset structs (amount/nai/precision).
        liquid = acc["balance"]["HIVE"]["liquid"]
        assert hasattr(liquid, "amount") and hasattr(liquid, "nai") and hasattr(liquid, "precision")
        # Manabar leaves are real structs with current_mana.
        assert "current_mana" in acc["upvote_manabar"]
        assert "max" in acc["upvote_manabar"]
        assert "current_mana" in acc["downvote_manabar"]

    @pytest.mark.asyncio
    async def test_total_balances_sum_the_same_components_as_typescript(self, mock_worker: FakeWorker) -> None:
        base = build_account("alice")
        account = build_account(
            "alice",
            hbd_balance=type(base.hbd_balance)(amount="100", precision=3, nai="@@000000013"),
            reward_hbd_balance=type(base.reward_hbd_balance)(amount="7", precision=3, nai="@@000000013"),
            savings_hbd_balance=type(base.savings_hbd_balance)(amount="11", precision=3, nai="@@000000013"),
            balance=type(base.balance)(amount="200", precision=3, nai="@@000000021"),
            reward_hive_balance=type(base.reward_hive_balance)(amount="8", precision=3, nai="@@000000021"),
            savings_balance=type(base.savings_balance)(amount="9", precision=3, nai="@@000000021"),
            vesting_shares=type(base.vesting_shares)(amount="300", precision=6, nai="@@000000037"),
            reward_vesting_balance=type(base.reward_vesting_balance)(amount="10", precision=6, nai="@@000000037"),
            delegated_vesting_shares=type(base.delegated_vesting_shares)(amount="11", precision=6, nai="@@000000037"),
            received_vesting_shares=type(base.received_vesting_shares)(amount="12", precision=6, nai="@@000000037"),
            vesting_withdraw_rate=type(base.vesting_withdraw_rate)(amount="13", precision=6, nai="@@000000037"),
        )

        async def find_accounts(**kwargs: object) -> object:
            return find_accounts_response(account)

        mock_worker.chain.api.database_api.find_accounts = find_accounts
        collector = AccountCollector(worker=mock_worker)
        collector.register({"account": "alice"})

        result = await collector.get(_TimingCtx())
        balance = result[AccountClassifier.__name__]["accounts"]["alice"]["balance"]

        assert balance["HBD"]["savings"].amount == "11"
        assert balance["HBD"]["total"].amount == "107"
        assert balance["HIVE"]["total"].amount == "217"
        assert balance["HP"]["total"].amount == "346"

    @pytest.mark.asyncio
    async def test_account_metadata_is_parsed_like_typescript_with_empty_object_fallback(self, mock_worker: FakeWorker) -> None:
        account = build_account(
            "alice",
            json_metadata='{"profile":{"name":"Alice"}}',
            posting_json_metadata="{not-json",
        )

        async def find_accounts(**kwargs: object) -> object:
            return find_accounts_response(account)

        mock_worker.chain.api.database_api.find_accounts = find_accounts
        collector = AccountCollector(worker=mock_worker)
        collector.register({"account": "alice"})

        result = await collector.get(_TimingCtx())
        account_data = result[AccountClassifier.__name__]["accounts"]["alice"]

        assert account_data["json_metadata"] == {"profile": {"name": "Alice"}}
        assert account_data["posting_json_metadata"] == {}

    @pytest.mark.asyncio
    async def test_empty_when_untracked(self, mock_worker: FakeWorker) -> None:
        collector = AccountCollector(worker=mock_worker)
        result = await collector.get(_TimingCtx())
        assert result[AccountClassifier.__name__]["accounts"] == {}

    @pytest.mark.asyncio
    async def test_provider_selects_tracked_account(self, mock_worker: FakeWorker) -> None:
        collector = AccountCollector(worker=mock_worker)
        collector.register({"account": "alice"})
        collected = await collector.get(_TimingCtx())

        provider = AccountProvider()
        provider.push_options({"accounts": ["alice"]})
        out = await provider.provide(_ClassifierCtx(AccountClassifier, collected[AccountClassifier.__name__]))

        assert out["accounts"]["alice"]["name"] == "alice"

    @pytest.mark.asyncio
    async def test_provider_keeps_missing_tracked_account_as_none(self) -> None:
        provider = AccountProvider()
        provider.push_options({"accounts": ["ghost"]})

        out = await provider.provide(_ClassifierCtx(AccountClassifier, {"accounts": {}}))

        assert out["accounts"] == {"ghost": None}

    @pytest.mark.asyncio
    async def test_provider_preserves_first_registration_order(self) -> None:
        provider = AccountProvider()
        provider.push_options({"accounts": ["gtg", "blocktrades"]})
        provider.push_options({"accounts": ["gtg", "thebeedevs"]})

        assert _context_options(provider.used_contexts(), "account") == ["gtg", "blocktrades", "thebeedevs"]

        out = await provider.provide(
            _ClassifierCtx(
                AccountClassifier,
                {
                    "accounts": {
                        "blocktrades": {"name": "blocktrades"},
                        "gtg": {"name": "gtg"},
                        "thebeedevs": {"name": "thebeedevs"},
                    },
                },
            )
        )

        assert list(out["accounts"]) == ["gtg", "blocktrades", "thebeedevs"]


# ---------------------------------------------------------------------------
# WitnessCollector
# ---------------------------------------------------------------------------


class TestWitnessCollector:
    @pytest.mark.asyncio
    async def test_reshapes_real_witness(self, mock_worker: FakeWorker) -> None:
        collector = WitnessCollector(worker=mock_worker)
        collector.register({"witness": "witness-a"})

        result = await collector.get(_TimingCtx())
        witnesses = result[WitnessClassifier.__name__]["witnesses"]

        assert "witness-a" in witnesses
        w = witnesses["witness-a"]
        assert set(w) == {"owner", "running_version", "total_missed_blocks", "last_confirmed_block_num"}
        assert w["owner"] == "witness-a"
        assert w["total_missed_blocks"] == 0

    @pytest.mark.asyncio
    async def test_provider_selects_tracked_witness(self, mock_worker: FakeWorker) -> None:
        collector = WitnessCollector(worker=mock_worker)
        collector.register({"witness": "witness-a"})
        collected = await collector.get(_TimingCtx())

        provider = WitnessProvider()
        provider.push_options({"accounts": ["witness-a"]})
        out = await provider.provide(_ClassifierCtx(WitnessClassifier, collected[WitnessClassifier.__name__]))

        assert out["witnesses"]["witness-a"]["owner"] == "witness-a"

    @pytest.mark.asyncio
    async def test_provider_keeps_missing_tracked_witness_as_none(self) -> None:
        provider = WitnessProvider()
        provider.push_options({"accounts": ["ghost"]})

        out = await provider.provide(_ClassifierCtx(WitnessClassifier, {"witnesses": {}}))

        assert out["witnesses"] == {"ghost": None}

    def test_provider_preserves_first_registration_order(self) -> None:
        provider = WitnessProvider()
        provider.push_options({"accounts": ["gtg", "blocktrades"]})
        provider.push_options({"accounts": ["gtg", "thebeedevs"]})

        assert _context_options(provider.used_contexts(), "witness") == ["gtg", "blocktrades", "thebeedevs"]


# ---------------------------------------------------------------------------
# RcAccountCollector
# ---------------------------------------------------------------------------


class TestRcAccountCollector:
    @pytest.mark.asyncio
    async def test_reshapes_real_rc_account(self, mock_worker: FakeWorker) -> None:
        collector = RcAccountCollector(worker=mock_worker)
        collector.register({"rc_account": "alice"})

        result = await collector.get(_TimingCtx())
        rc_accounts = result[RcAccountClassifier.__name__]["rc_accounts"]

        assert "alice" in rc_accounts
        rc = rc_accounts["alice"]
        assert rc["name"] == "alice"
        assert "current_mana" in rc["rc_manabar"]
        assert "max_rc" in rc["rc_manabar"]

    @pytest.mark.asyncio
    async def test_provider_selects_tracked_rc_account(self, mock_worker: FakeWorker) -> None:
        collector = RcAccountCollector(worker=mock_worker)
        collector.register({"rc_account": "alice"})
        collected = await collector.get(_TimingCtx())

        provider = RcAccountProvider()
        provider.push_options({"accounts": ["alice"]})
        out = await provider.provide(_ClassifierCtx(RcAccountClassifier, collected[RcAccountClassifier.__name__]))

        assert out["rc_accounts"]["alice"]["name"] == "alice"

    @pytest.mark.asyncio
    async def test_provider_keeps_missing_tracked_rc_account_as_none(self) -> None:
        provider = RcAccountProvider()
        provider.push_options({"accounts": ["ghost"]})

        out = await provider.provide(_ClassifierCtx(RcAccountClassifier, {"rc_accounts": {}}))

        assert out["rc_accounts"] == {"ghost": None}


class TestManabarProvider:
    def test_provider_preserves_account_and_manabar_type_order(self) -> None:
        provider = ManabarProvider()
        provider.push_options(
            {
                "manabar_data": [
                    {"account": "gtg", "manabar_type": ManabarType.RC},
                    {"account": "blocktrades", "manabar_type": ManabarType.UPVOTE},
                    {"account": "gtg", "manabar_type": ManabarType.DOWNVOTE},
                ],
            }
        )

        contexts = provider.used_contexts()

        assert _context_options(contexts, "account") == ["gtg", "gtg", "blocktrades"]
        assert _context_options(contexts, "manabar_type") == [ManabarType.RC, ManabarType.DOWNVOTE, ManabarType.UPVOTE]
