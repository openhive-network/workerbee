from __future__ import annotations

from typing import Any
from dataclasses import dataclass

from wax.models.asset import NaiAsset
from schemas.fields.hive_datetime import HiveDateTime

from workerbee.chain_observers.classifiers.collector_classifier_base import (
    CollectorClassifierBase,
    RegisterEvaluationContext,
)


@dataclass
class HiveAssetDetailedBalance:
    liquid: NaiAsset
    unclaimed: NaiAsset
    delegated: NaiAsset


@dataclass
class ManabarData:
    current_mana: int
    last_update_time: HiveDateTime


@dataclass
class MaxManabarData:
    max: int


@dataclass
class HiveAssetWithSavingsDetailedBalance(HiveAssetDetailedBalance):
    savings: NaiAsset


@dataclass
class HiveHPAssetDetailedBalance(HiveAssetDetailedBalance):
    delegated: NaiAsset
    received: NaiAsset
    powering_down: NaiAsset


@dataclass
class AccountBalance:
    HBD: HiveAssetWithSavingsDetailedBalance
    HIVE: HiveAssetWithSavingsDetailedBalance
    HP: HiveHPAssetDetailedBalance


@dataclass
class Account:
    name: str
    upvote_manabar: ManabarData
    downvote_manabar: ManabarData
    posting_json_metadata: dict[str, Any]
    json_metadata: dict[str, Any]
    balance: AccountBalance
    recovery_account: str
    governance_voting_expiration: HiveDateTime | None = None


@dataclass
class AccountData:
    accounts: dict[str, Account]


@dataclass
class AccountsCollectorOptions:
    account: str


class AccountsClassifier(
    CollectorClassifierBase[AccountData, None, None, AccountsCollectorOptions]
):
    @classmethod
    def for_options(
        cls,
        options: AccountsCollectorOptions | None = None,
    ) -> RegisterEvaluationContext:
        return {
            "class_": cls,
            "options": options,  # type: ignore[typeddict-item]
        }
