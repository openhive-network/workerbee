"""InternalMarketProvider — provides internal market (limit order) operations.

Mirrors src/chain-observers/providers/internal-market-provider.ts.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import InternalMarketPair, InternalMarketPayload


class InternalMarketProvider(ProviderBase):
    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> InternalMarketPayload:
        operations = await data.get(OperationClassifier)
        ops_per_type = operations["operations_per_type"]

        order_create = ops_per_type.get("limit_order_create_operation")
        order_create2 = ops_per_type.get("limit_order_create2_operation")
        order_cancel = ops_per_type.get("limit_order_cancel_operation")

        internal_market_operations: list[InternalMarketPair] = []

        if order_cancel:
            for op in order_cancel:
                operation = op["operation"]
                owner = operation.get("owner")
                order_id = operation.get("orderid")
                if not isinstance(owner, str) or not isinstance(order_id, int):
                    continue
                internal_market_operations.append(
                    {
                        "operation": {
                            "cancel": True,
                            "owner": owner,
                            "order_id": order_id,
                        },
                        "transaction": op["transaction"],
                    }
                )

        if order_create:
            for op in order_create:
                operation = op["operation"]
                owner = operation.get("owner")
                order_id = operation.get("orderid")
                filled = operation.get("fill_or_kill")
                expiration_raw = operation.get("expiration")
                if not isinstance(owner, str) or not isinstance(order_id, int) or not isinstance(filled, bool):
                    continue
                if isinstance(expiration_raw, str):
                    expiration = datetime.fromisoformat(
                        expiration_raw if expiration_raw.endswith("Z") or "+" in expiration_raw else expiration_raw + "Z",
                    ).replace(tzinfo=UTC)
                elif isinstance(expiration_raw, datetime):
                    expiration = expiration_raw
                else:
                    continue

                internal_market_operations.append(
                    {
                        "operation": {
                            "cancel": False,
                            "owner": owner,
                            "order_id": order_id,
                            "amount_to_sell": operation.get("amount_to_sell"),
                            "filled": filled,
                            "exchange_rate": {
                                "base": operation.get("amount_to_sell"),
                                "quote": operation.get("min_to_receive"),
                            },
                            "expiration": expiration,
                        },
                        "transaction": op["transaction"],
                    }
                )

        if order_create2:
            for op in order_create2:
                operation = op["operation"]
                owner = operation.get("owner")
                order_id = operation.get("orderid")
                filled = operation.get("fill_or_kill")
                exchange_rate = operation.get("exchange_rate")
                expiration_raw = operation.get("expiration")
                if not isinstance(owner, str) or not isinstance(order_id, int) or not isinstance(filled, bool) or not isinstance(exchange_rate, dict):
                    continue
                if isinstance(expiration_raw, str):
                    expiration = datetime.fromisoformat(
                        expiration_raw if expiration_raw.endswith("Z") or "+" in expiration_raw else expiration_raw + "Z",
                    ).replace(tzinfo=UTC)
                elif isinstance(expiration_raw, datetime):
                    expiration = expiration_raw
                else:
                    continue

                internal_market_operations.append(
                    {
                        "operation": {
                            "cancel": False,
                            "owner": owner,
                            "order_id": order_id,
                            "amount_to_sell": operation.get("amount_to_sell"),
                            "filled": filled,
                            "exchange_rate": dict(exchange_rate),
                            "expiration": expiration,
                        },
                        "transaction": op["transaction"],
                    }
                )

        return {"internal_market_operations": internal_market_operations}
