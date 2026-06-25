"""SetManagedCollector — mixin for collectors that track a set of names via push_options/pop_options.

Eliminates repeated push/pop/set boilerplate across AccountCollector, WitnessCollector,
RcAccountCollector, ChangeRecoveryInProgressCollector, DeclineVotingRightsCollector.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING, Any

from .collector_base import CollectorBase

if TYPE_CHECKING:
    from ..interfaces import IWorkerBee


class SetManagedCollector(CollectorBase):
    """Collector that maintains a ref-counted dict of tracked items via a single dict key."""

    _options_key: str = ""
    _chunk_size = 1_000

    def __init__(self, worker: IWorkerBee) -> None:
        super().__init__(worker)
        self._tracked: dict[str, int] = {}

    def push_options(self, data: Any) -> None:
        if isinstance(data, dict) and self._options_key in data:
            key = data[self._options_key]
            self._tracked[key] = self._tracked.get(key, 0) + 1

    def pop_options(self, data: Any) -> None:
        if isinstance(data, dict) and self._options_key in data:
            key = data[self._options_key]
            count = self._tracked.get(key, 1) - 1
            if count <= 0:
                self._tracked.pop(key, None)
            else:
                self._tracked[key] = count

    def _tracked_chunks(self) -> Iterator[list[str]]:
        items = list(self._tracked)
        for index in range(0, len(items), self._chunk_size):
            yield items[index : index + self._chunk_size]
