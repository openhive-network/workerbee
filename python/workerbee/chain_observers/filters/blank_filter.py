"""BlankFilter — always matches. Used when no filters are specified."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..factories.data_evaluation_context import DataEvaluationContext


class BlankFilter(FilterBase):
    async def match(self, data: DataEvaluationContext) -> bool:
        return True
