"""AccountMetadataChangeFilter — stateful, tracks previous json_metadata / posting_json_metadata.

Mirrors src/chain-observers/filters/account-metadata-change-filter.ts.

Uses AccountClassifier.for_options.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class AccountMetadataChangeFilter(FilterBase):
    def __init__(self, accounts: list[str]) -> None:
        super().__init__()
        self._accounts: OrderedSet[str] = OrderedSet(accounts)
        self._previous_metadata_by_account: dict[str, tuple[str, str]] = {}

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.account_classifier import AccountClassifier

        classifiers: list[TRegisterEvaluationContext] = []
        for account in self._accounts:
            classifiers.append(AccountClassifier.for_options({"account": account}))

        return classifiers

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.account_classifier import AccountClassifier

        result = await data.get(AccountClassifier)
        accounts = result["accounts"]

        for account_name in self._accounts:
            account = accounts.get(account_name)

            if account is None:
                return False

            posting_meta = json.dumps(account["posting_json_metadata"], sort_keys=True)
            acc_meta = json.dumps(account["json_metadata"], sort_keys=True)

            previous = self._previous_metadata_by_account.get(account_name)
            if previous is None:
                self._previous_metadata_by_account[account_name] = (acc_meta, posting_meta)
                continue

            previous_acc_meta, previous_posting_meta = previous
            changed_acc_meta = acc_meta != previous_acc_meta
            changed_posting = posting_meta != previous_posting_meta

            self._previous_metadata_by_account[account_name] = (acc_meta, posting_meta)

            if changed_acc_meta or changed_posting:
                return True

        return False
