"""ImpactedAccountCollector — groups operations by impacted account.

Mirrors src/chain-observers/collectors/common/impacted-account-collector.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.impacted_account_classifier import ImpactedAccountClassifier
from ...classifiers.operation_classifier import OperationClassifier
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class ImpactedAccountCollector(CollectorBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        op_data = await data.get(OperationClassifier)
        operations = op_data["operations"]

        impacted: dict[str, dict[str, Any]] = {}

        with data.add_timing("operation_get_impacted_accounts"):
            for pair in operations:
                op = pair["operation"]
                # wax's get_operation_impacted_accounts only recognises str / dict /
                # protobuf; the hf26 block_api Operation model is none of those, so pass
                # its plain dict envelope ({"type", "value"}).
                op_envelope = op if isinstance(op, dict) else {"type": op.type, "value": op.value}
                accounts: list[str] = self.worker.chain.get_operation_impacted_accounts(op_envelope)
                for account in accounts:
                    if account not in impacted:
                        impacted[account] = {"name": account, "operations": []}
                    impacted[account]["operations"].append(pair)

        return {ImpactedAccountClassifier.__name__: {"impacted_accounts": impacted}}
