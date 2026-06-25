"""BucketAggregateQueue — time-bucketed queue for batch processing.

Mirrors src/types/queue.ts (BucketAggregateQueue).
Groups values into buckets by numeric key (typically timestamps),
supports efficient batch dequeue of all items up to a given key.
"""

from __future__ import annotations

import bisect
from collections.abc import Iterator
from typing import TypeVar

T = TypeVar("T")


class BucketAggregateQueue[T]:
    def __init__(self, bucket_size: int) -> None:
        if bucket_size <= 0:
            raise ValueError("bucket_size must be positive")
        self._bucket_size = bucket_size
        self._buckets: dict[int, list[T]] = {}
        self._sorted_keys: list[int] = []

    def enqueue(self, key: int, data: T) -> None:
        bucket_key = (key // self._bucket_size) * self._bucket_size
        bucket = self._buckets.get(bucket_key)
        if bucket is None:
            bucket = []
            bisect.insort(self._sorted_keys, bucket_key)
            self._buckets[bucket_key] = bucket
        bucket.append(data)

    def dequeue_until(self, max_value: int) -> Iterator[T]:
        cut = bisect.bisect_right(self._sorted_keys, max_value)
        if cut == 0:
            return

        keys_to_remove = self._sorted_keys[:cut]
        self._sorted_keys = self._sorted_keys[cut:]

        for bucket_key in keys_to_remove:
            bucket = self._buckets.pop(bucket_key)
            yield from bucket

    @property
    def size(self) -> int:
        total = 0
        for bucket in self._buckets.values():
            total += len(bucket)
        return total
