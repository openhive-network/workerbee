"""ManabarProvider — provides manabar data for accounts.

Mirrors src/chain-observers/providers/manabar-provider.ts.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .._ordered_set import OrderedSet
from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
from ..classifiers.manabar_classifier import ManabarClassifier
from ..enums import ManabarType
from .provider_base import ProviderBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext
    from ..payloads import ManabarPayload, ManabarValue


class ManabarProvider(ProviderBase):
    def __init__(self) -> None:
        # Maps account -> set of manabar types
        self.manabar_data: dict[str, OrderedSet[ManabarType]] = {}

    def push_options(self, options: Any) -> None:
        for entry in options["manabar_data"]:
            account = entry["account"]
            manabar_type = ManabarType(entry["manabar_type"])
            if account in self.manabar_data:
                self.manabar_data[account].add(manabar_type)
            else:
                self.manabar_data[account] = OrderedSet([manabar_type])

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        contexts: list[TRegisterEvaluationContext] = []
        for account, manabar_types in self.manabar_data.items():
            for manabar_type in manabar_types:
                contexts.append(
                    ManabarClassifier.for_options(
                        {"account": account, "manabar_type": manabar_type},
                    ),
                )
        return contexts

    async def provide(self, data: DataEvaluationContext) -> ManabarPayload:
        manabar_result = await data.get(ManabarClassifier)
        source = manabar_result["manabar_data"]

        manabar_data: dict[str, dict[ManabarType, ManabarValue]] = {}
        for account, manabar_types in self.manabar_data.items():
            per_account = manabar_data.setdefault(account, {})

            for manabar_type in manabar_types:
                if source.get(account) is None:
                    break
                value = source[account].get(manabar_type)
                if value is not None:
                    per_account[manabar_type] = value

        return {"manabar_data": manabar_data}
