"""Chunking parity for JSON-RPC collectors with TS 1000-item request limits."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from types import SimpleNamespace

import pytest

from workerbee.chain_observers.classifiers.account_classifier import AccountClassifier
from workerbee.chain_observers.classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from workerbee.chain_observers.classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from workerbee.chain_observers.classifiers.rc_account_classifier import RcAccountClassifier
from workerbee.chain_observers.classifiers.witness_classifier import WitnessClassifier
from workerbee.chain_observers.collectors.jsonrpc.account_collector import AccountCollector
from workerbee.chain_observers.collectors.jsonrpc.change_recovery_in_progress_collector import ChangeRecoveryInProgressCollector
from workerbee.chain_observers.collectors.jsonrpc.decline_voting_rights_collector import DeclineVotingRightsCollector
from workerbee.chain_observers.collectors.jsonrpc.rc_account_collector import RcAccountCollector
from workerbee.chain_observers.collectors.jsonrpc.witness_collector import WitnessCollector

from ._builders import build_account, find_accounts_response


class _TimingCtx:
    @contextmanager
    def add_timing(self, name: str) -> Iterator[None]:
        yield


class _ChunkingApi:
    def __init__(self) -> None:
        self.account_calls: list[list[str]] = []
        self.rc_calls: list[list[str]] = []
        self.witness_calls: list[list[str]] = []
        self.recovery_calls: list[list[str]] = []
        self.decline_calls: list[list[str]] = []

    async def find_accounts(self, *, accounts: list[str]) -> object:
        self.account_calls.append(accounts)
        return find_accounts_response(
            *[
                build_account(
                    account,
                    json_metadata=f'{{"profile":{{"name":"{account}"}}}}',
                )
                for account in accounts
            ]
        )

    async def find_rc_accounts(self, *, accounts: list[str]) -> object:
        self.rc_calls.append(accounts)
        return SimpleNamespace(
            rc_accounts=[
                SimpleNamespace(
                    account=account,
                    rc_manabar=SimpleNamespace(current_mana=1, last_update_time=2),
                    max_rc=3,
                )
                for account in accounts
            ],
        )

    async def find_witnesses(self, *, owners: list[str]) -> object:
        self.witness_calls.append(owners)
        return SimpleNamespace(
            witnesses=[
                SimpleNamespace(
                    owner=owner,
                    running_version="1.0.0",
                    total_missed=0,
                    last_confirmed_block_num=1,
                )
                for owner in owners
            ],
        )

    async def find_change_recovery_account_requests(self, *, accounts: list[str]) -> object:
        self.recovery_calls.append(accounts)
        return SimpleNamespace(
            requests=[
                SimpleNamespace(
                    account_to_recover=account,
                    recovery_account="hive.fund",
                    effective_on="2026-01-01T00:00:00",
                )
                for account in accounts
            ],
        )

    async def find_decline_voting_rights_requests(self, *, accounts: list[str]) -> object:
        self.decline_calls.append(accounts)
        return SimpleNamespace(
            requests=[
                SimpleNamespace(
                    account=account,
                    effective_date="2026-01-01T00:00:00",
                )
                for account in accounts
            ],
        )


def _worker(api: _ChunkingApi) -> object:
    return SimpleNamespace(chain=SimpleNamespace(api=SimpleNamespace(database_api=api, rc_api=api)))


def _names() -> list[str]:
    return [f"account-{index:04d}" for index in range(1001)]


def _register_all(collector: object, option_key: str, names: list[str]) -> None:
    for name in names:
        collector.register({option_key: name})


def _chunk_sizes(calls: list[list[str]]) -> list[int]:
    return [len(call) for call in calls]


class TestJsonRpcCollectorChunking:
    @pytest.mark.asyncio
    async def test_accounts_are_chunked_and_reshaped_like_typescript(self) -> None:
        api = _ChunkingApi()
        collector = AccountCollector(_worker(api))
        names = _names()
        _register_all(collector, "account", names)

        result = await collector.get(_TimingCtx())
        accounts = result[AccountClassifier.__name__]["accounts"]

        assert _chunk_sizes(api.account_calls) == [1000, 1]
        assert len(accounts) == len(names)
        assert accounts["account-0000"]["name"] == "account-0000"
        assert accounts["account-0000"]["json_metadata"] == {"profile": {"name": "account-0000"}}
        assert accounts["account-1000"]["name"] == "account-1000"
        assert set(accounts["account-1000"]["balance"]) == {"HBD", "HIVE", "HP"}
        assert "current_mana" in accounts["account-1000"]["upvote_manabar"]

    @pytest.mark.asyncio
    async def test_rc_accounts_are_chunked_like_typescript(self) -> None:
        api = _ChunkingApi()
        collector = RcAccountCollector(_worker(api))
        names = _names()
        _register_all(collector, "rc_account", names)

        result = await collector.get(_TimingCtx())

        assert _chunk_sizes(api.rc_calls) == [1000, 1]
        assert len(result[RcAccountClassifier.__name__]["rc_accounts"]) == len(names)

    @pytest.mark.asyncio
    async def test_witnesses_are_chunked_like_typescript(self) -> None:
        api = _ChunkingApi()
        collector = WitnessCollector(_worker(api))
        names = _names()
        _register_all(collector, "witness", names)

        result = await collector.get(_TimingCtx())

        assert _chunk_sizes(api.witness_calls) == [1000, 1]
        assert len(result[WitnessClassifier.__name__]["witnesses"]) == len(names)

    @pytest.mark.asyncio
    async def test_recovery_requests_are_chunked_like_typescript(self) -> None:
        api = _ChunkingApi()
        collector = ChangeRecoveryInProgressCollector(_worker(api))
        names = _names()
        _register_all(collector, "change_recovery_account", names)

        result = await collector.get(_TimingCtx())

        assert _chunk_sizes(api.recovery_calls) == [1000, 1]
        assert len(result[ChangeRecoveryInProgressClassifier.__name__]["recovering_accounts"]) == len(names)

    @pytest.mark.asyncio
    async def test_decline_voting_rights_requests_are_chunked_like_typescript(self) -> None:
        api = _ChunkingApi()
        collector = DeclineVotingRightsCollector(_worker(api))
        names = _names()
        _register_all(collector, "decline_voting_rights_account", names)

        result = await collector.get(_TimingCtx())

        assert _chunk_sizes(api.decline_calls) == [1000, 1]
        assert len(result[DeclineVotingRightsClassifier.__name__]["decline_voting_rights_accounts"]) == len(names)
