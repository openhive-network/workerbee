/**
 * The current value of a manabar - `calculateCurrentManabarValue` of wax without its WebAssembly.
 *
 * Mirrors `__current_manabar` of wax (`core/foundation.cpp`) and `manabar::regenerate_mana` of hive
 * (`libraries/chain/include/hive/chain/util/manabar.hpp`); `tests/manabar.test.mjs` compares it with wax.
 */
import type { IManabarData, TNaiAssetConvertible } from "@hiveio/wax";

/** HIVE_RC_REGEN_TIME: wax regenerates every kind of manabar over 5 days */
const REGENERATION_SECONDS = 5n * 24n * 60n * 60n;

const PERCENT_VALUE_DOUBLE_PRECISION = 100;
const ONE_HUNDRED_PERCENT = 100n * BigInt(PERCENT_VALUE_DOUBLE_PRECISION);

const regenerate = (now: number, max: bigint, current: bigint, lastUpdateTime: number): bigint => {
  if (current >= max)
    return max;

  // Like wax: `now` before the last update counts as the last update - hive would fail
  const elapsed = BigInt(Math.max(now, lastUpdateTime) - lastUpdateTime);
  if (elapsed === 0n)
    return current;

  const regenerated = (max >= 0n ? max : 0n) * (elapsed > REGENERATION_SECONDS ? REGENERATION_SECONDS : elapsed) / REGENERATION_SECONDS;
  const mana = current + regenerated;

  return mana > max ? max : mana;
};

export const calculateCurrentManabarValue = (
  now: number,
  maxMana: TNaiAssetConvertible,
  currentMana: TNaiAssetConvertible,
  lastUpdateTime: number
): IManabarData => {
  // Intentionally not `===`, as in wax: the same check for numbers, strings and bigints
  if (maxMana == 0)
    return { max: 0n, current: 0n, percent: 100 };

  const max = BigInt(maxMana);
  const current = regenerate(now, max, BigInt(currentMana), lastUpdateTime);

  return {
    max,
    current,
    percent: Number((current * ONE_HUNDRED_PERCENT) / max) / PERCENT_VALUE_DOUBLE_PRECISION
  };
};
