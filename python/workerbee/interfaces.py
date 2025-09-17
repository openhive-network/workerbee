from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator
from dataclasses import dataclass

from wax import IHiveChainInterface
from wax.proto.transaction import transaction

from workerbee.bot import StartConfiguration
from workerbee.chain_observers.classifiers.block_classifier import BlockData
from workerbee.chain_observers.classifiers.block_header_classifier import (
    BlockHeaderData,
)
from workerbee.queen import QueenBee


@dataclass
class BroadcastOptions:
    verify_signatures: bool = False
    """If true, the bot will verify if the signatures in the transaction, applied on chain match the local ones"""
    expire_in_ms: int = 6000
    """Time in ms after the transaction will be considered expired"""


@dataclass
class BroadcastData:
    transaction: transaction
    block: BlockHeaderData


class Block(BlockHeaderData, BlockData):
    """Is it a valid name? Probably not. CHANGE IT."""


class IWorkerBee(ABC):
    @property
    @abstractmethod
    def running(self) -> bool:
        """Indicates if the bot is running."""

    @property
    @abstractmethod
    def configuration(self) -> StartConfiguration:
        """Returns the configuration of the bot."""

    @property
    @abstractmethod
    def chain(self) -> IHiveChainInterface | None:
        """
        Returns the chain interface used by the bot.


        Please note that this can be None if the bot is not started yet.
        Remember that chain property will be initialized during `start` call and uninitialized during `delete`
        """

    @property
    @abstractmethod
    def observe(self) -> QueenBee:
        """Allows to iterate over blocks in live mode"""

    @property
    @abstractmethod
    def version(self) -> str:
        """Returns the version of the library."""

    @abstractmethod
    async def start(self) -> None:
        """Starts the automation with given configuration."""

    @abstractmethod
    def stop(self) -> None:
        """Request automation stop."""

    @abstractmethod
    def delete(self) -> None:
        """Deletes the bot instance and cleans up resources."""

    @abstractmethod
    async def iterate(self) -> AsyncIterator[Block | BlockHeaderData]:
        """Allows to iterate over blocks in live mode."""
