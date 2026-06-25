"""Shared enumerations — mirrors TS enums from @hiveio/wax and WorkerBee."""

from __future__ import annotations

from enum import IntEnum, StrEnum


class ManabarType(IntEnum):
    UPVOTE = 0
    DOWNVOTE = 1
    RC = 2


class AlarmType(IntEnum):
    """Account security/governance alarms (mirrors TS EAlarmType)."""

    LEGACY_RECOVERY_ACCOUNT_SET = 0
    GOVERNANCE_VOTE_EXPIRATION_SOON = 1
    GOVERNANCE_VOTE_EXPIRED = 2
    RECOVERY_ACCOUNT_IS_CHANGING = 3
    DECLINING_VOTING_RIGHTS = 4


class Exchange(StrEnum):
    """Known Hive exchange names (mirrors TS Exchange).

    ``str`` mixin so members compare equal to the plain exchange-name strings
    the API and existing tests use (``Exchange.BINANCE == "Binance"``).
    """

    BINANCE = "Binance"
    HTX = "HTX"
    MEXC = "MEXC"
    PROBIT = "ProBit"
    UPBIT = "Upbit"
