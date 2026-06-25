"""CompositeFilter — LogicalAndFilter, LogicalOrFilter.

Mirrors src/chain-observers/filters/composite-filter.ts.

AND: all operands must match.
OR: any operand matches.
Operands are started together and decisive results settle early, matching the
TypeScript Promise.all/race shape.
Both aggregate used_contexts() from all operands.
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import TYPE_CHECKING, Any

from .filter_base import FilterBase

if TYPE_CHECKING:
    from ..classifiers.collector_classifier_base import TRegisterEvaluationContext
    from ..factories.data_evaluation_context import DataEvaluationContext


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

    async def _race_operands(self, data: DataEvaluationContext, *, decisive_value: bool, fallback_value: bool) -> bool:
        tasks = {asyncio.create_task(filt.match(data)) for filt in self.operands}
        for task in tasks:
            task.add_done_callback(_consume_task_result)

        pending = set(tasks)
        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                errors: list[BaseException] = []
                for task in done:
                    if task.cancelled():
                        errors.append(asyncio.CancelledError())
                        continue
                    error = task.exception()
                    if error is not None:
                        errors.append(error)
                        continue
                    result = bool(task.result())
                    if result is decisive_value:
                        return decisive_value
                if errors:
                    raise errors[0]
            return fallback_value
        finally:
            await _cancel_pending(pending)


class LogicalAndFilter(CompositeFilter):
    async def match(self, data: DataEvaluationContext) -> bool:
        return await self._race_operands(data, decisive_value=False, fallback_value=True)


class LogicalOrFilter(CompositeFilter):
    async def match(self, data: DataEvaluationContext) -> bool:
        return await self._race_operands(data, decisive_value=True, fallback_value=False)


def _consume_task_result(task: asyncio.Task[bool]) -> None:
    if task.cancelled():
        return
    with contextlib.suppress(Exception):
        task.result()


async def _cancel_pending(tasks: set[asyncio.Task[bool]]) -> None:
    if not tasks:
        return
    pending = list(tasks)
    tasks.clear()
    for task in pending:
        task.cancel()
    await asyncio.gather(*pending, return_exceptions=True)
