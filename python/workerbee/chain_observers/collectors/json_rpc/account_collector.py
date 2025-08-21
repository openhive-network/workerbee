from __future__ import annotations

import json
from typing import Final
from collections import Counter

from schemas.fields.hive_datetime import HiveDateTime

from workerbee.bot import WorkerBee
from workerbee.chain_observers.collectors.collector_base import CollectorBase
from workerbee.chain_observers.classifiers.accounts_classifier import (
    AccountsClassifier,
    Account,
    ManabarData,
    MaxManabarData,
    AccountBalance,
    HiveAssetWithSavingsDetailedBalance,
    HiveHPAssetDetailedBalance, AccountData,
)
from workerbee.chain_observers.factories.data_evaluation_context import (
    CollectorEvaluationContext,
)

MAX_ACCOUNT_GET_LIMIT: Final[int] = 1000


class AccountCollector(CollectorBase[AccountsClassifier]):
    def __init__(self, worker: WorkerBee) -> None:
        super().__init__(worker)
        self._accounts: Counter[str] = Counter()
        """Counter to store account names and their respective counts."""

    async def get(self, data: CollectorEvaluationContext) -> dict[str, AccountData]:
        accounts: dict[str, Account] = {}
        account_names = list(self._accounts.keys())

        for i in range(0, len(account_names), MAX_ACCOUNT_GET_LIMIT):
            accounts_chunk = account_names[i : i + MAX_ACCOUNT_GET_LIMIT]

            start_find_accounts = HiveDateTime.now()
            find_accounts_response = (
                await self._worker.chain.api.database_api.find_accounts(
                    accounts=accounts_chunk
                )
            )
            data.add_timing(
                "database_api.find_accounts", HiveDateTime.now() - start_find_accounts
            )

            start_account_analysis = HiveDateTime.now()

            for account in find_accounts_response.accounts:
                governance_voting_expiration = (
                    None  # TODO: Adjust after swagger correction
                )

                accounts[account.name] = Account(
                    name=account.name,
                    upvote_manabar=MaxManabarData(
                        account.voting_manabar.current_mana,
                        HiveDateTime(
                            str(account.voting_manabar.last_update_time * 1000)
                        ),
                        int(account.post_voting_power.amount),
                    ),
                    downvote_manabar=ManabarData(
                        account.downvote_manabar.current_mana,
                        HiveDateTime(
                            str(account.downvote_manabar.last_update_time * 1000)
                        ),
                    ),
                    posting_json_metadata=json.loads(account.posting_json_metadata),
                    json_metadata=json.loads(account.json_metadata),
                    balance=AccountBalance(
                        HBD=HiveAssetWithSavingsDetailedBalance(
                            liquid=self._worker.chain.hbd.satoshis(
                                int(account.hbd_balance.amount)
                            ),
                            unclaimed=self._worker.chain.hbd.satoshis(
                                int(account.reward_hbd_balance.amount)
                            ),
                            total=self._worker.chain.hbd.satoshis(
                                int(account.hbd_balance.amount)
                                + int(account.reward_hbd_balance.amount)
                            ),
                            savings=self._worker.chain.hbd.satoshis(
                                int(account.savings_hbd_balance.amount)
                            ),
                        ),
                        HIVE=HiveAssetWithSavingsDetailedBalance(
                            liquid=self._worker.chain.hive.satoshis(
                                int(account.balance.amount)
                            ),
                            unclaimed=self._worker.chain.hive.satoshis(
                                int(account.reward_hive_balance.amount)
                            ),
                            total=self._worker.chain.hive.satoshis(
                                int(account.balance.amount)
                                + int(account.reward_hive_balance.amount)
                                + int(account.reward_hive_balance.amount)
                            ),
                            savings=self._worker.chain.hive.satoshis(
                                int(account.savings_balance.amount)
                            ),
                        ),
                        HP=HiveHPAssetDetailedBalance(
                            liquid=self._worker.chain.vests.satoshis(
                                int(account.vesting_shares.amount)
                            ),
                            unclaimed=self._worker.chain.vests.satoshis(
                                int(account.reward_vesting_balance.amount)
                            ),
                            total=self._worker.chain.vests.satoshis(
                                int(account.vesting_shares.amount)
                                + int(account.reward_vesting_balance.amount)
                                + int(account.delegated_vesting_shares.amount)
                                + int(account.received_vesting_shares.amount)
                                + int(account.vesting_withdraw_rate.amount)
                            ),
                            delegated=self._worker.chain.vests.satoshis(
                                int(account.delegated_vesting_shares.amount)
                            ),
                            received=self._worker.chain.vests.satoshis(
                                int(account.received_vesting_shares.amount)
                            ),
                            powering_down=self._worker.chain.vests.satoshis(
                                int(account.vesting_withdraw_rate.amount)
                            ),
                        ),
                    ),
                    recovery_account=account.recovery_account,
                    governance_voting_expiration=governance_voting_expiration,
                )

                data.add_timing(
                    "account_analysis", HiveDateTime.now() - start_account_analysis
                )

        return {
            AccountsClassifier.__class__.__name__: AccountData(accounts=accounts)
        }

    def _push_options(self, data: AccountsClassifier.options_type) -> None:
        self._accounts[data.account] += 1

    def _pop_options(self, data: AccountsClassifier.options_type) -> None:
        self._accounts[data.account] -= 1 if self._accounts[data.account] > 0 else 0

        if self._accounts[data.account] == 0:
            self._accounts.pop(data.account)

async def main():
    data = await AccountCollector().get()
    data["test"].accounts.get("alice").