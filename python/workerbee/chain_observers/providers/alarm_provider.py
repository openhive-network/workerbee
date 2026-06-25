"""AlarmProvider — provides account security/governance alarms.

Mirrors src/chain-observers/providers/alarm-provider.ts.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from ..classifiers.account_classifier import AccountClassifier
from ..classifiers.change_recovery_in_progress_classifier import ChangeRecoveryInProgressClassifier
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier
from ..enums import AlarmType  # re-exported here for back-compat (was defined locally)
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import AlarmsPayload

STEEM_ACCOUNT_NAME = "steem"
ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 31

AlarmOptions = dict[str, list[str]]

__all__ = ["AlarmProvider", "AlarmType"]


class AlarmProvider(ProviderBase):
    def __init__(self) -> None:
        self.accounts: OrderedSet[str] = OrderedSet()

    def push_options(self, options: AlarmOptions) -> None:
        accounts = options.get("accounts", [])
        if not accounts:
            raise ValueError("accounts must not be empty")
        for account in accounts:
            self.accounts.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        contexts: list[TRegisterEvaluationContext] = []
        for account in self.accounts:
            contexts.append(AccountClassifier.for_options({"account": account}))
            contexts.append(
                ChangeRecoveryInProgressClassifier.for_options(
                    {"change_recovery_account": account},
                ),
            )
            contexts.append(
                DeclineVotingRightsClassifier.for_options(
                    {"decline_voting_rights_account": account},
                ),
            )
        return contexts

    async def provide(self, data: DataEvaluationContext) -> AlarmsPayload:
        result: dict[str, list[AlarmType]] = {}

        def ensure_has_account(account: str) -> list[AlarmType]:
            if account not in result:
                result[account] = []
            return result[account]

        accounts_data = await data.get(AccountClassifier)
        accounts = accounts_data["accounts"]
        for account in self.accounts:
            acct = accounts.get(account)
            if acct is None:
                continue

            if acct["recovery_account"] == STEEM_ACCOUNT_NAME:
                ensure_has_account(account).append(AlarmType.LEGACY_RECOVERY_ACCOUNT_SET)

            gov_expiration = acct["governance_vote_expiration"]
            if gov_expiration is None:
                ensure_has_account(account).append(AlarmType.GOVERNANCE_VOTE_EXPIRED)
            elif isinstance(gov_expiration, datetime):
                expiration_ms = gov_expiration.timestamp() * 1000
                if expiration_ms < (time.time() * 1000 + ONE_MONTH_MS):
                    ensure_has_account(account).append(AlarmType.GOVERNANCE_VOTE_EXPIRATION_SOON)

        recovery_data = await data.get(ChangeRecoveryInProgressClassifier)
        recovering_accounts = recovery_data["recovering_accounts"]
        for account in self.accounts:
            if recovering_accounts.get(account):
                ensure_has_account(account).append(AlarmType.RECOVERY_ACCOUNT_IS_CHANGING)

        decline_data = await data.get(DeclineVotingRightsClassifier)
        decline_accounts = decline_data["decline_voting_rights_accounts"]
        for account in self.accounts:
            if decline_accounts.get(account):
                ensure_has_account(account).append(AlarmType.DECLINING_VOTING_RIGHTS)

        return {"alarms_per_account": result}
