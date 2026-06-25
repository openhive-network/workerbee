"""AlarmFilter — checks multiple alarm conditions on accounts.

Mirrors src/chain-observers/filters/alarm-filter.ts.

Uses AccountClassifier + ChangeRecoveryInProgressClassifier + DeclineVotingRightsClassifier.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext

STEEM_ACCOUNT_NAME = "steem"
ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 31


class AlarmFilter(FilterBase):
    def __init__(self, accounts: list[str]) -> None:
        super().__init__()
        self._accounts: OrderedSet[str] = OrderedSet(accounts)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.account_classifier import AccountClassifier
        from ..classifiers.change_recovery_in_progress_classifier import (
            ChangeRecoveryInProgressClassifier,
        )
        from ..classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier

        classifiers: list[TRegisterEvaluationContext] = []
        for account in self._accounts:
            classifiers.append(AccountClassifier.for_options({"account": account}))
            classifiers.append(
                ChangeRecoveryInProgressClassifier.for_options(
                    {"change_recovery_account": account},
                ),
            )
            classifiers.append(
                DeclineVotingRightsClassifier.for_options(
                    {"decline_voting_rights_account": account},
                ),
            )

        return classifiers

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.account_classifier import AccountClassifier
        from ..classifiers.change_recovery_in_progress_classifier import (
            ChangeRecoveryInProgressClassifier,
        )
        from ..classifiers.decline_voting_rights_classifier import DeclineVotingRightsClassifier

        account_result = await data.get(AccountClassifier)
        accounts = account_result["accounts"]

        for account_name in self._accounts:
            account = accounts.get(account_name)

            if account is None:
                return False

            if account["recovery_account"] == STEEM_ACCOUNT_NAME:
                return True

            if account["governance_vote_expiration"] is None:
                return True

            # governance_vote_expiration is a datetime; compare in ms
            expiration_ms = account["governance_vote_expiration"].timestamp() * 1000
            now_ms = time.time() * 1000
            if expiration_ms < (now_ms + ONE_MONTH_MS):
                return True

            recovery_result = await data.get(ChangeRecoveryInProgressClassifier)
            if recovery_result["recovering_accounts"].get(account_name):
                return True

            decline_result = await data.get(DeclineVotingRightsClassifier)
            if decline_result["decline_voting_rights_accounts"].get(account_name):
                return True

        return False
