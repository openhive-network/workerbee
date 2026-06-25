"""CompositeFilter — LogicalAndFilter, LogicalOrFilter.

Mirrors src/chain-observers/filters/composite-filter.ts.

AND: all operands must match (short-circuit on first False).
OR: any operand matches (short-circuit on first True).
Both aggregate used_contexts() from all operands.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


class _UnsatisfiedFilterError(Exception):
    pass


class CompositeFilter(FilterBase):
    def __init__(self, operands: list[FilterBase]) -> None:
        super().__init__()
        self.operands = operands

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        seen: set[Any] = set()
        result: list[TRegisterEvaluationContext] = []
        for operand in self.operands:
            for ctx in operand.used_contexts():
                key = id(ctx) if isinstance(ctx, dict) else ctx
                if key not in seen:
                    seen.add(key)
                    result.append(ctx)
        return result

    async def _evaluate_operands(
        self,
        data: DataEvaluationContext,
        force_cancel_value: bool | None = None,
        force_resolve_value: bool | None = None,
        require_force_resolve: bool = False,
    ) -> None:
        for filt in self.operands:
            result = await filt.match(data)
            if result is force_resolve_value and force_resolve_value is not None:
                return
            if result is force_cancel_value and force_cancel_value is not None:
                raise _UnsatisfiedFilterError()

        if require_force_resolve:
            raise _UnsatisfiedFilterError()


class LogicalAndFilter(CompositeFilter):
    async def match(self, data: DataEvaluationContext) -> bool:
        try:
            await self._evaluate_operands(data, force_cancel_value=False)
            return True
        except _UnsatisfiedFilterError:
            return False


class LogicalOrFilter(CompositeFilter):
    async def match(self, data: DataEvaluationContext) -> bool:
        try:
            await self._evaluate_operands(data, force_resolve_value=True, require_force_resolve=True)
            return True
        except _UnsatisfiedFilterError:
            return False
