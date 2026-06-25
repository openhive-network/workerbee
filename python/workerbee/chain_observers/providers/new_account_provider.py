"""NewAccountProvider — provides newly created accounts from the block.

Mirrors src/chain-observers/providers/new-account-provider.ts.
"""

from __future__ import annotations

import contextlib
import json
from typing import TYPE_CHECKING, Any

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import NewAccountData, NewAccountsPayload


class NewAccountProvider(ProviderBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> NewAccountsPayload:
        result: list[NewAccountData] = []

        operations = await data.get(OperationClassifier)
        ops_per_type = operations["operations_per_type"]

        all_ops: list[Any] = [
            *(ops_per_type.get("create_claimed_account_operation") or []),
            *(ops_per_type.get("account_create_operation") or []),
            *(ops_per_type.get("account_create_with_delegation_operation") or []),
        ]

        for op_pair in all_ops:
            operation = op_pair["operation"]

            json_metadata: dict[str, Any] = {}
            raw_metadata = operation.get("json_metadata")
            if raw_metadata:
                with contextlib.suppress(json.JSONDecodeError, TypeError):
                    json_metadata = json.loads(raw_metadata)

            result.append(
                {
                    "account_name": operation["new_account_name"],
                    "active": operation.get("active"),
                    "creator": operation["creator"],
                    "json_metadata": json_metadata,
                    "memo": operation["memo_key"],
                    "owner": operation.get("owner"),
                    "posting": operation.get("posting"),
                }
            )

        return {"new_accounts": result}
