from __future__ import annotations

from wax import IHiveChainInterface

from workerbee.wax.get_wax import get_wax


class WorkerBee:
    @property
    def chain(self) -> IHiveChainInterface:
        """Return the chain interface."""
        return get_wax()
