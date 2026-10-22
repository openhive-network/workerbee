"""Shared transfer operation helpers for the whale alert filter/provider and the exchange transfer provider.

``TRANSFER_AMOUNT_FIELDS`` is the one table of the transfer operations and their amount fields.
"""

from __future__ import annotations

from collections.abc import Mapping

# The transfer operations and their amount fields, in the order they are checked - an escrow transfer is
# reported by its HBD amount, else by its HIVE amount (as the whale alert of TS). The first field is the
# general-purpose amount (TS reports an escrow transfer to an exchange by its HBD amount).
TRANSFER_AMOUNT_FIELDS: dict[str, tuple[str, ...]] = {
    "transfer_operation": ("amount",),
    "transfer_from_savings_operation": ("amount",),
    "escrow_transfer_operation": ("hbd_amount", "hive_amount"),
    "recurrent_transfer_operation": ("amount",),
}

TRANSFER_OP_TYPES = tuple(TRANSFER_AMOUNT_FIELDS)


def get_transfer_amount(op: Mapping[str, object], op_type: str) -> object:
    operation = op.get("operation")
    if not isinstance(operation, dict):
        return None
    return operation.get(TRANSFER_AMOUNT_FIELDS[op_type][0])
