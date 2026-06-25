"""Shared transfer operation helpers for whale_alert and exchange_transfer providers."""

from __future__ import annotations

from collections.abc import Mapping

TRANSFER_OP_TYPES = (
    "transfer_operation",
    "transfer_from_savings_operation",
    "escrow_transfer_operation",
    "recurrent_transfer_operation",
)


def get_transfer_amount(op: Mapping[str, object], op_type: str) -> object:
    operation = op.get("operation")
    if not isinstance(operation, dict):
        return None
    if op_type == "escrow_transfer_operation":
        return operation.get("hbd_amount")
    return operation.get("amount")
