"""Governance observer behavior without a locally managed chain.

Missed-block generation depends on node runtime settings, so the old end-to-end
setup cannot be expressed against mirrornet. The saved coverage is the public
filter behavior: a witness emits only after its missed count rises while the
last confirmed block stays frozen.
"""

from __future__ import annotations

import pytest

from workerbee.chain_observers.classifiers.witness_classifier import WitnessClassifier
from workerbee.chain_observers.filters.witness_miss_block_filter import WitnessMissedBlocksFilter

_WITNESS = "alice"


class _WitnessContext:
    def __init__(self, *, missed: int, last_confirmed_block: int) -> None:
        self._payload = {
            "witnesses": {
                _WITNESS: {
                    "owner": _WITNESS,
                    "total_missed_blocks": missed,
                    "last_confirmed_block_num": last_confirmed_block,
                },
            },
        }

    async def get(self, classifier: type[WitnessClassifier]) -> dict[str, object]:
        assert classifier is WitnessClassifier
        return self._payload


@pytest.mark.asyncio
async def test_on_witnesses_missed_blocks() -> None:
    filt = WitnessMissedBlocksFilter([_WITNESS], missed_blocks_count_min=1)

    assert await filt.match(_WitnessContext(missed=10, last_confirmed_block=100)) is False
    assert await filt.match(_WitnessContext(missed=12, last_confirmed_block=100)) is True


@pytest.mark.asyncio
async def test_on_witnesses_missed_blocks_resets_when_witness_produces() -> None:
    filt = WitnessMissedBlocksFilter([_WITNESS], missed_blocks_count_min=1)

    assert await filt.match(_WitnessContext(missed=10, last_confirmed_block=100)) is False
    assert await filt.match(_WitnessContext(missed=11, last_confirmed_block=101)) is False
    assert await filt.match(_WitnessContext(missed=12, last_confirmed_block=101)) is False
    assert await filt.match(_WitnessContext(missed=13, last_confirmed_block=101)) is True
