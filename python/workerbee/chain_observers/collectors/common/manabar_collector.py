"""ManabarCollector — calculates manabar percentages.

Mirrors src/chain-observers/collectors/common/manabar-collector.ts.
Uses chain.calculate_current_manabar_value() for real mana regeneration calculation.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from ...classifiers.account_classifier import AccountClassifier
from ...classifiers.collector_classifier_base import TRegisterEvaluationContext
from ...classifiers.dynamic_global_properties_classifier import DynamicGlobalPropertiesClassifier
from ...classifiers.manabar_classifier import ManabarClassifier
from ...classifiers.rc_account_classifier import RcAccountClassifier
from ...enums import ManabarType
from ..collector_base import CollectorBase

if TYPE_CHECKING:
    from ...factories.data_evaluation_context import TCollectorEvaluationContext
    from ...interfaces import IWorkerBee

PERCENT_VALUE_DOUBLE_PRECISION = 100
ONE_HUNDRED_PERCENT = 100 * PERCENT_VALUE_DOUBLE_PRECISION

ManabarOptions = dict[str, str | int]
ManabarEntry = dict[str, int | float | datetime]
ManabarPerAccount = dict[int, ManabarEntry]
ManabarResult = dict[str, ManabarPerAccount]


class ManabarCollector(CollectorBase):
    def __init__(self, worker: IWorkerBee) -> None:
        super().__init__(worker)
        self._upvote_accounts: dict[str, int] = {}
        self._downvote_accounts: dict[str, int] = {}
        self._rc_accounts: dict[str, int] = {}

    def _select_container(self, manabar_type: int) -> dict[str, int]:
        if manabar_type == ManabarType.UPVOTE:
            return self._upvote_accounts
        if manabar_type == ManabarType.DOWNVOTE:
            return self._downvote_accounts
        if manabar_type == ManabarType.RC:
            return self._rc_accounts
        raise ValueError(f"Unsupported manabar type: {manabar_type}")

    def push_options(self, data: ManabarOptions) -> None:
        account = str(data.get("account", ""))
        manabar_type = int(data.get("manabar_type", -1))
        if not account:
            raise ValueError("account must not be empty")
        container = self._select_container(manabar_type)
        container[account] = container.get(account, 0) + 1

    def pop_options(self, data: ManabarOptions) -> None:
        account = str(data.get("account", ""))
        manabar_type = int(data.get("manabar_type", -1))
        if not account:
            return
        container = self._select_container(manabar_type)
        count = container.get(account, 0)
        if count > 1:
            container[account] = count - 1
        else:
            container.pop(account, None)

    def used_contexts(self) -> list[TRegisterEvaluationContext]:
        classifiers: list[TRegisterEvaluationContext] = [DynamicGlobalPropertiesClassifier]
        for account in self._upvote_accounts:
            classifiers.append(AccountClassifier.for_options({"account": account}))
        for account in self._downvote_accounts:
            classifiers.append(AccountClassifier.for_options({"account": account}))
        for rc_account in self._rc_accounts:
            classifiers.append(RcAccountClassifier.for_options({"rc_account": rc_account}))
        return classifiers

    async def get(self, data: TCollectorEvaluationContext) -> dict[str, object]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        head_block_time: datetime = dgp["head_block_time"]
        downvote_pool_percent: int = dgp.get("downvote_pool_percent", 0)

        manabar_data: ManabarResult = {}

        if self._rc_accounts:
            rc_data = await data.get(RcAccountClassifier)
            rc_accounts_map = rc_data["rc_accounts"]

            for account in self._rc_accounts:
                if account not in manabar_data:
                    manabar_data[account] = {}

                rc_info = rc_accounts_map.get(account)
                if rc_info is None:
                    manabar_data[account][ManabarType.RC] = _zero_entry(head_block_time)
                    continue

                rc_manabar = rc_info["rc_manabar"]
                manabar_data[account][ManabarType.RC] = self._calculate(
                    data,
                    head_block_time,
                    max_mana=_get_int(rc_manabar, "max_rc", "max_mana"),
                    current_mana=_get_int(rc_manabar, "current_mana"),
                    last_update_time=_get_int(rc_manabar, "last_update_time"),
                )

        if self._upvote_accounts or self._downvote_accounts:
            acc_data = await data.get(AccountClassifier)
            accounts_map = acc_data["accounts"]

            for account in self._upvote_accounts:
                if account not in manabar_data:
                    manabar_data[account] = {}

                acc_info = accounts_map.get(account)
                if acc_info is None:
                    manabar_data[account][ManabarType.UPVOTE] = _zero_entry(head_block_time)
                    continue

                upvote_manabar = acc_info["upvote_manabar"]
                manabar_data[account][ManabarType.UPVOTE] = self._calculate(
                    data,
                    head_block_time,
                    max_mana=_get_int(upvote_manabar, "max_mana", "max"),
                    current_mana=_get_int(upvote_manabar, "current_mana"),
                    last_update_time=_get_int(upvote_manabar, "last_update_time"),
                )

            for account in self._downvote_accounts:
                if account not in manabar_data:
                    manabar_data[account] = {}

                acc_info = accounts_map.get(account)
                if acc_info is None:
                    manabar_data[account][ManabarType.DOWNVOTE] = _zero_entry(head_block_time)
                    continue

                upvote_manabar = acc_info["upvote_manabar"]
                downvote_manabar = acc_info["downvote_manabar"]

                upvote_max = _get_int(upvote_manabar, "max_mana", "max")
                if upvote_max // ONE_HUNDRED_PERCENT > ONE_HUNDRED_PERCENT:
                    effective_max = (upvote_max // ONE_HUNDRED_PERCENT) * downvote_pool_percent
                else:
                    effective_max = upvote_max * downvote_pool_percent // ONE_HUNDRED_PERCENT

                manabar_data[account][ManabarType.DOWNVOTE] = self._calculate(
                    data,
                    head_block_time,
                    max_mana=effective_max,
                    current_mana=_get_int(downvote_manabar, "current_mana"),
                    last_update_time=_get_int(downvote_manabar, "last_update_time"),
                )

        return {ManabarClassifier.__name__: {"manabar_data": manabar_data}}

    def _calculate(
        self,
        data: TCollectorEvaluationContext,
        head_block_time: datetime,
        max_mana: int,
        current_mana: int,
        last_update_time: int,
    ) -> ManabarEntry:
        with data.add_timing("calculate_current_manabar_value"):
            result = self.worker.chain.calculate_current_manabar_value(
                head_block_time,
                max_mana,
                current_mana,
                last_update_time,
            )

        return {
            "current_mana": result.current_mana,
            "max": result.max_mana,
            "percent": float(result.percent),
            "last_update_time": _source_last_update_time(head_block_time, last_update_time),
        }


def _zero_entry(head_block_time: datetime) -> ManabarEntry:
    return {
        "current_mana": 0,
        "max": 0,
        "percent": 0.0,
        "last_update_time": head_block_time,
    }


def _source_last_update_time(head_block_time: datetime, last_update_time: int) -> datetime:
    source_time = datetime.fromtimestamp(last_update_time, UTC)
    if head_block_time.tzinfo is None:
        return source_time.replace(tzinfo=None)
    return source_time.astimezone(head_block_time.tzinfo)


def _get_int(obj: object, *keys: str) -> int:
    if not isinstance(obj, dict):
        for key in keys:
            val = getattr(obj, key, None)
            if val is not None:
                return int(val)
        return 0
    for key in keys:
        val = obj.get(key)
        if val is not None:
            return int(val)
    return 0
