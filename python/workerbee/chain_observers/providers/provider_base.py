"""ProviderBase — base class for all providers.

Mirrors src/chain-observers/providers/provider-base.ts.
Providers have provide() returning a dict, used_contexts(), and optional push_options().
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Mapping

    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class ProviderBase:
    """Base class for observer payload providers."""

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        """Classifier contexts that must be collected before :meth:`provide` runs."""
        return []

    def push_options(self, options: Any) -> None:
        """Merge fluent-builder options into this provider."""
        pass

    async def provide(self, data: DataEvaluationContext) -> Mapping[str, object]:
        """Return payload keys to merge into the delivered observer notification."""
        # Concrete providers return a typed payload TypedDict (see payloads.py);
        # Mapping[str, object] is the common supertype every such TypedDict (and
        # the inline dict providers) satisfies, so overrides stay covariant.
        raise NotImplementedError
