"""Insertion-ordered set matching JavaScript ``Set`` iteration semantics."""

from __future__ import annotations

from collections.abc import Hashable, Iterable, Iterator, MutableSet


class OrderedSet[T: Hashable](MutableSet[T]):
    """A small mutable set that preserves first-insertion order when iterated."""

    def __init__(self, values: Iterable[T] = ()) -> None:
        self._items: dict[T, None] = {}
        for value in values:
            self.add(value)

    def __contains__(self, value: object) -> bool:
        return value in self._items

    def __iter__(self) -> Iterator[T]:
        return iter(self._items)

    def __len__(self) -> int:
        return len(self._items)

    def add(self, value: T) -> None:
        self._items[value] = None

    def discard(self, value: T) -> None:
        self._items.pop(value, None)
