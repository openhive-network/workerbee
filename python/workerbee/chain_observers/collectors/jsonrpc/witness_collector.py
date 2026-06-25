"""WitnessCollector — fetches witness data via database_api.find_witnesses."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from ...classifiers.witness_classifier import WitnessClassifier
from ..set_managed_collector import SetManagedCollector

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext


class WitnessCollector(SetManagedCollector):
    _options_key = "witness"

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, Any]:
        if not self._tracked:
            return {WitnessClassifier.__name__: {"witnesses": {}}}

        witnesses: dict[str, Any] = {}
        for chunk in self._tracked_chunks():
            with data.add_timing("database_api.find_witnesses"):
                result = await self.worker.chain.api.database_api.find_witnesses(owners=chunk)

            for w in result.witnesses:
                owner = w.owner
                witnesses[owner] = {
                    "owner": owner,
                    "running_version": w.running_version,
                    "total_missed_blocks": w.total_missed,
                    "last_confirmed_block_num": w.last_confirmed_block_num,
                }

        return {WitnessClassifier.__name__: {"witnesses": witnesses}}
