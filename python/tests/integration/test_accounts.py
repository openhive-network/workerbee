"""Mirrornet-backed integration tests for account-related replay hooks."""

from __future__ import annotations

import pytest

from tests.integration._mirrornet import MirrornetReplay


@pytest.mark.asyncio
async def test_on_new_account_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        96685040,
        96685065,
        lambda bot, _chain, got, on_error, on_complete: bot.on_new_account().subscribe(on_next=got.append, on_error=on_error, on_complete=on_complete),
    )

    new_accounts = [
        f"New account created: {operation['account_name']} by {operation['creator']}" for note in notes for operation in note.get("new_accounts", [])
    ]
    assert new_accounts == ["New account created: fwaszkiewicz by gtg"]


@pytest.mark.asyncio
async def test_on_impacted_accounts_on_mirrornet(mirrornet_replay: MirrornetReplay) -> None:
    notes = await mirrornet_replay(
        94704950,
        94705000,
        lambda bot, _chain, got, on_error, on_complete: bot.on_impacted_accounts("lolzbot").subscribe(
            on_next=got.append, on_error=on_error, on_complete=on_complete
        ),
    )

    impacted_operations = [pair for note in notes for pair in note.get("impacted_accounts", {}).get("lolzbot", [])]
    transaction_ids = {pair["transaction"]["id"] for pair in impacted_operations}

    assert len(impacted_operations) == 6
    assert len(transaction_ids) == 6
