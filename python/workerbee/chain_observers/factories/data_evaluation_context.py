from __future__ import annotations

from typing import Protocol
from datetime import timedelta


class CollectorEvaluationContext(Protocol):
    def add_timing(self, name: str, time: timedelta) -> None: ...

    async def get(self, *args, **kwargs) -> None: ...

    async def query(self, *args, **kwargs) -> None: ...
