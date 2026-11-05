/*
 * The manabar of the nodes, computed without WebAssembly, against wax.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const { calculateCurrentManabarValue } = await import("../dist/workerbee/index.mjs");

const REGENERATION_SECONDS = 5 * 24 * 60 * 60;

describe("calculateCurrentManabarValue", () => {
  let chain;

  before(async () => {
    const wax = await import("@hiveio/wax");
    chain = await wax.createWaxFoundation();
  });

  after(() => chain?.delete());

  it("computes what wax computes", () => {
    const now = 1_790_000_000;
    const cases = [
      [now, 0, 0, now],
      [now, "1000", "0", now],
      [now, 1000n, 0n, now - 1],
      [now, "123456789012345", "1", now - REGENERATION_SECONDS / 2],
      [now, "123456789012345", "-5000", now - REGENERATION_SECONDS * 2],
      [now, "5000", "5000", now - 100],
      [now, "5000", "7000", now - 100],
      [now - 10, "5000", "100", now],
      [now, "9223372036854775807", "9000000000000000000", now - 3],
    ];

    let seed = 7;
    const random = (limit) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed % limit;
    };
    for (let i = 0; i < 500; ++i) {
      const max = BigInt(random(2_000_000_000)) * BigInt(random(1_000_000) + 1);
      cases.push([now, max, (max * BigInt(random(101))) / 100n, now - random(REGENERATION_SECONDS * 2)]);
    }

    for (const args of cases) assert.deepEqual(calculateCurrentManabarValue(...args), chain.calculateCurrentManabarValue(...args), `for ${args.join(", ")}`);
  });
});
