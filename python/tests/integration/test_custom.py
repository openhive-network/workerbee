"""Mirrornet integration tests for custom filter/provider escape hatches."""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import pytest

from workerbee import DataEvaluationContext, DynamicGlobalPropertiesClassifier, WorkerBee

if TYPE_CHECKING:
    from workerbee.chain_observers.payloads import ObserverNotification
    from workerbee.chain_observers.queen import QueenBee

TIMEOUT_SECS = 90.0


async def _current_shuffled_witnesses(workerbee: WorkerBee) -> list[str]:
    schedule = await workerbee.chain.api.database_api.get_witness_schedule()
    return list(schedule.current_shuffled_witnesses)


async def _collect_first(queen: QueenBee) -> ObserverNotification:
    received: list[ObserverNotification] = []
    errors: list[BaseException] = []
    done = asyncio.Event()

    def on_next(payload: ObserverNotification) -> None:
        received.append(payload)
        done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = queen.subscribe(on_next=on_next, on_error=on_error)
    try:
        async with asyncio.timeout(TIMEOUT_SECS):
            await done.wait()
        if errors:
            raise errors[0]
        return received[0]
    finally:
        subscription.close()


@pytest.mark.asyncio
async def test_custom_filter_sync_emits_only_when_predicate_true(workerbee: WorkerBee) -> None:
    """A sync predicate gates delivery across live mirrornet evaluation cycles."""
    attempts = 0

    def predicate(_data: DataEvaluationContext) -> bool:
        nonlocal attempts
        attempts += 1
        return attempts >= 2

    def provider(_data: DataEvaluationContext) -> dict[str, int]:
        return {"attempt": attempts}

    payload = await _collect_first(workerbee.observe.filter(predicate).provide(provider))

    assert payload["attempt"] >= 2


@pytest.mark.asyncio
async def test_add_timing_surfaces_in_subscription_timings(workerbee: WorkerBee) -> None:
    """``data.add_timing(name)`` inside a custom provider surfaces via timings."""
    received: list[ObserverNotification] = []
    errors: list[BaseException] = []
    done = asyncio.Event()

    async def provider(data: DataEvaluationContext) -> dict[str, bool]:
        with data.add_timing("custom_phase"):
            await asyncio.sleep(0.01)
        return {"timed": True}

    def on_next(payload: ObserverNotification) -> None:
        received.append(payload)
        done.set()

    def on_error(error: BaseException) -> None:
        errors.append(error)
        done.set()

    subscription = (
        workerbee.observe.on_block()
        .provide(provider)
        .subscribe(
            on_next=on_next,
            on_error=on_error,
        )
    )
    try:
        async with asyncio.timeout(TIMEOUT_SECS):
            await done.wait()
        if errors:
            raise errors[0]
        timings = subscription.timings
    finally:
        subscription.close()

    assert received
    assert "custom_phase" in timings, timings
    assert timings["custom_phase"] > 0.0


@pytest.mark.asyncio
async def test_custom_filter_async_predicate_works(workerbee: WorkerBee) -> None:
    """An async predicate is awaited and its boolean result is honoured."""
    attempts = 0

    async def predicate(_data: DataEvaluationContext) -> bool:
        nonlocal attempts
        attempts += 1
        await asyncio.sleep(0)
        return attempts >= 2

    def provider(_data: DataEvaluationContext) -> dict[str, int]:
        return {"attempt": attempts}

    payload = await _collect_first(workerbee.observe.filter(predicate).provide(provider))

    assert payload["attempt"] >= 2


@pytest.mark.asyncio
async def test_custom_filter_can_use_witness_schedule_rpc(workerbee: WorkerBee) -> None:
    """Mirror TS custom filter: compare DGP current_witness with witness schedule RPC."""
    witness_schedule = await _current_shuffled_witnesses(workerbee)

    async def predicate(data: DataEvaluationContext) -> bool:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        return dgp["current_witness"] in witness_schedule

    async def provider(data: DataEvaluationContext) -> dict[str, str]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        return {"current_witness": dgp["current_witness"]}

    payload = await _collect_first(workerbee.observe.filter(predicate).provide(provider))

    assert payload["current_witness"] in witness_schedule


@pytest.mark.asyncio
async def test_custom_provider_merges_keys_into_payload(workerbee: WorkerBee) -> None:
    """``provide(fn)`` merges the fn's returned dict into the delivered payload."""
    payload = await _collect_first(
        workerbee.observe.on_block().provide(lambda _data: {"my_key": 123}),
    )

    assert payload["my_key"] == 123
    assert "block" in payload


@pytest.mark.asyncio
async def test_custom_provider_can_expose_current_witness_from_dgp(workerbee: WorkerBee) -> None:
    """Mirror TS custom provider: expose current_witness from DGP classifier."""
    witness_schedule = await _current_shuffled_witnesses(workerbee)

    async def expose_current_witness(data: DataEvaluationContext) -> dict[str, str]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        return {"current_witness": dgp["current_witness"]}

    payload = await _collect_first(workerbee.observe.provide(expose_current_witness))

    assert payload["current_witness"] in witness_schedule


@pytest.mark.asyncio
async def test_data_get_returns_dgp_inside_custom_provider(workerbee: WorkerBee) -> None:
    """``await data.get(DynamicGlobalPropertiesClassifier)`` works in a provider."""

    async def expose_head(data: DataEvaluationContext) -> dict[str, int]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        return {"head_from_dgp": dgp["head_block_number"]}

    payload = await _collect_first(workerbee.observe.on_block().provide(expose_head))

    head = payload["head_from_dgp"]
    assert isinstance(head, int)
    assert head >= 1
    assert head == payload["block"]["number"]


@pytest.mark.asyncio
async def test_filter_piped_provider_feeds_filter_and_payload(workerbee: WorkerBee) -> None:
    """``filter_piped(provider_fn, filter_fn)`` pipes provider output into the filter."""
    provider_attempts: list[int] = []
    filter_seen: list[dict[str, int]] = []

    async def provider_fn(data: DataEvaluationContext) -> dict[str, int]:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        attempt = len(provider_attempts) + 1
        provider_attempts.append(attempt)
        return {"piped_attempt": attempt, "piped_head": dgp["head_block_number"]}

    def filter_fn(provided: dict[str, int], _data: DataEvaluationContext) -> bool:
        filter_seen.append(provided)
        return provided["piped_attempt"] >= 2

    payload = await _collect_first(workerbee.observe.filter_piped(provider_fn, filter_fn))

    assert provider_attempts[:2] == [1, 2]
    assert [seen["piped_attempt"] for seen in filter_seen[:2]] == [1, 2]
    assert payload["piped_attempt"] == 2
    piped_head = payload["piped_head"]
    assert isinstance(piped_head, int)
    assert piped_head >= 1


@pytest.mark.asyncio
async def test_filter_piped_can_pass_witness_schedule(workerbee: WorkerBee) -> None:
    """Mirror TS filterPiped: fetch witness schedule, then filter on current_witness."""

    async def provider_fn(_data: DataEvaluationContext) -> dict[str, list[str]]:
        return {"witness_schedule": await _current_shuffled_witnesses(workerbee)}

    async def filter_fn(provided: dict[str, list[str]], data: DataEvaluationContext) -> bool:
        dgp = await data.get(DynamicGlobalPropertiesClassifier)
        return dgp["current_witness"] in provided["witness_schedule"]

    payload = await _collect_first(workerbee.observe.filter_piped(provider_fn, filter_fn))

    assert payload["witness_schedule"]
