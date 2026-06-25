"""ExchangeTransferProvider — provides transfer operations involving known exchanges.

Mirrors src/chain-observers/providers/exchange-transfer-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from ..utils import is_exchange
from ._transfer_helpers import TRANSFER_OP_TYPES, get_transfer_amount
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import ExchangeTransferPair, ExchangeTransferPayload


class ExchangeTransferProvider(ProviderBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> ExchangeTransferPayload:
        operations = await data.get(OperationClassifier)
        ops_per_type = operations["operations_per_type"]

        exchange_transfers: list[ExchangeTransferPair] = []

        for op_type in TRANSFER_OP_TYPES:
            ops = ops_per_type.get(op_type)
            if not ops:
                continue

            for op in ops:
                operation = op["operation"]
                from_exchange = is_exchange(str(operation.get("from", "")))
                to_exchange = is_exchange(str(operation.get("to", "")))
                if not from_exchange and not to_exchange:
                    continue

                amount = get_transfer_amount(op, op_type)
                exchange_transfers.append(
                    cast(
                        "ExchangeTransferPair",
                        {
                            "operation": {
                                "from": operation.get("from", ""),
                                "to": operation.get("to", ""),
                                "amount": amount,
                                "exchange": from_exchange or to_exchange,
                            },
                            "transaction": op["transaction"],
                        },
                    )
                )

        return {"exchange_transfer_operations": exchange_transfers}
