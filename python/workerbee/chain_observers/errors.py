"""WorkerBee error classes.

Mirrors src/errors.ts.
"""

from __future__ import annotations


class WorkerBeeError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class BlockNotAvailableError(WorkerBeeError):
    def __init__(self, block_number: int) -> None:
        super().__init__(f"Block {block_number} is not available")
        self.block_number = block_number
