"""AccountCreatedFilter — matches account creation operations.

Mirrors src/chain-observers/filters/account-created-filter.ts.

Uses OperationClassifier. Matches account_create / account_create_with_delegation /
create_claimed_account operations.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class AccountCreatedFilter(FilterBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        from ..classifiers.operation_classifier import OperationClassifier

        return [OperationClassifier]

    async def match(self, data: DataEvaluationContext) -> bool:
        from ..classifiers.operation_classifier import OperationClassifier

        result = await data.get(OperationClassifier)
        operations_per_type = result["operations_per_type"]

        return bool(
            operations_per_type.get("account_create_operation")
            or operations_per_type.get("account_create_with_delegation_operation")
            or operations_per_type.get("create_claimed_account_operation"),
        )
