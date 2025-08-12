"""
Module created to configure a wax just once.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from wax import create_hive_chain

if TYPE_CHECKING:
    from wax import IHiveChainInterface
    from wax.wax_options import WaxChainOptions


def get_wax(options: WaxChainOptions | None = None) -> IHiveChainInterface:
    """
    Get a configured wax chain interface.

    Args:
        options: Optional configuration for the wax chain.

    Returns:
        IHiveChainInterface: The wax chain interface.
    """
    return create_hive_chain(options)
