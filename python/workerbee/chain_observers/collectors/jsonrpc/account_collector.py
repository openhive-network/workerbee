"""AccountCollector — fetches account data via database_api.find_accounts.

Mirrors src/chain-observers/collectors/jsonrpc/account-collector.ts.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import TYPE_CHECKING, Any

from ...classifier_results import AccountClassifierData
from ...classifiers.account_classifier import AccountClassifier
from ..collector_base import TCollectorResult
from ..set_managed_collector import SetManagedCollector

if TYPE_CHECKING:
    from hiveio_api import Asset

    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...payloads import AccountData


def _governance_expiration(expiration: datetime) -> datetime | None:
    # Mirrors src/chain-observers/collectors/jsonrpc/account-collector.ts: an epoch time
    # (getTime() <= 0) is None - the sentinel of accounts with no governance vote.
    return expiration if expiration.timestamp() > 0 else None


def _total_asset(base: Asset, *parts: Asset) -> Asset:
    """Sum of the parts - an asset of the kind of `base`."""
    total = base * 0
    for part in parts:
        total += part
    return total


def _parse_json_metadata(raw: object) -> dict[str, Any]:
    try:
        parsed = json.loads(str(raw))
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


class AccountCollector(SetManagedCollector):
    _options_key = "account"

    async def get(self, data: TCollectorEvaluationContext) -> TCollectorResult:
        if not self._tracked:
            return {AccountClassifier: AccountClassifierData(accounts={})}

        accounts: dict[str, AccountData | None] = {}

        for chunk in self._tracked_chunks():
            # wax binds chain.api.<api> at runtime; mypy sees the unbound class method.
            with data.add_timing("database_api.find_accounts"):
                result = await self.worker.chain.api.database_api.find_accounts(accounts=chunk)

            for acc in result.accounts:
                name = acc.name
                accounts[name] = {
                    "name": name,
                    "balance": {
                        "HBD": {
                            "liquid": acc.hbd_balance,
                            "savings": acc.savings_hbd_balance,
                            "unclaimed": acc.reward_hbd_balance,
                            "total": _total_asset(acc.hbd_balance, acc.hbd_balance, acc.reward_hbd_balance),
                        },
                        "HIVE": {
                            "liquid": acc.balance,
                            "savings": acc.savings_balance,
                            "unclaimed": acc.reward_hive_balance,
                            "total": _total_asset(acc.balance, acc.balance, acc.reward_hive_balance, acc.savings_balance),
                        },
                        "HP": {
                            "liquid": acc.vesting_shares,
                            "delegated": acc.delegated_vesting_shares,
                            "received": acc.received_vesting_shares,
                            "powering_down": acc.vesting_withdraw_rate,
                            "unclaimed": acc.reward_vesting_balance,
                            "total": _total_asset(
                                acc.vesting_shares,
                                acc.vesting_shares,
                                acc.reward_vesting_balance,
                                acc.delegated_vesting_shares,
                                acc.received_vesting_shares,
                                acc.vesting_withdraw_rate,
                            ),
                        },
                    },
                    # Mirror account-collector.ts: synthesise the upvote manabar with
                    # ``max`` from the account's post_voting_power (the raw voting_manabar
                    # struct carries no max). Downvote has no max source (TS omits it).
                    "upvote_manabar": {
                        "current_mana": acc.voting_manabar.current_mana,
                        "max": acc.post_voting_power.amount,
                        "last_update_time": acc.voting_manabar.last_update_time,
                    },
                    "downvote_manabar": {
                        "current_mana": acc.downvote_manabar.current_mana,
                        "last_update_time": acc.downvote_manabar.last_update_time,
                    },
                    "json_metadata": _parse_json_metadata(acc.json_metadata),
                    "posting_json_metadata": _parse_json_metadata(acc.posting_json_metadata),
                    "recovery_account": acc.recovery_account,
                    "governance_vote_expiration": _governance_expiration(acc.governance_vote_expiration_ts),
                }

        return {AccountClassifier: AccountClassifierData(accounts=accounts)}
