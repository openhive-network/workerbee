"""VoteProvider — provides vote operations grouped by voter.

Mirrors src/chain-observers/providers/vote-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.operation_classifier import OperationClassifier
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import OpBodyTransactionPair, VotesPayload

VoteOptions = dict[str, list[str]]


class VoteProvider(ProviderBase):
    def __init__(self) -> None:
        self.voters: OrderedSet[str] = OrderedSet()

    def push_options(self, options: VoteOptions) -> None:
        voters = options.get("voters", [])
        for account in voters:
            self.voters.add(account)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        return [OperationClassifier]

    async def provide(self, data: DataEvaluationContext) -> VotesPayload:
        result: dict[str, list[OpBodyTransactionPair]] = {}

        operations = await data.get(OperationClassifier)
        vote_ops = operations["operations_per_type"].get("vote_operation")
        if vote_ops:
            for operation in vote_ops:
                voter = operation["operation"]["voter"]
                if not isinstance(voter, str):
                    continue
                if voter not in self.voters:
                    continue

                if voter not in result:
                    result[voter] = []

                result[voter].append(
                    {
                        "operation": operation["operation"],
                        "transaction": operation["transaction"],
                    }
                )

        return {"votes": result}
