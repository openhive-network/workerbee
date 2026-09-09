import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { normalizeJson, normalizeNotification, MANABAR_TYPE_NAMES, ALARM_TYPE_NAMES } = shared("normalize");

/*
 * The real container WorkerBee hands to subscribers, not a stand-in: what it
 * serialises to is exactly the problem this module exists to solve.
 */
const { WorkerBeeIterable } = await import("../dist/workerbee/index.mjs");

describe("normalizeJson", () => {
  it("unwraps a WorkerBeeIterable that would otherwise serialise as its wrapper", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(new WorkerBeeIterable([1, 2]))), { iterable: [1, 2] });
    assert.deepEqual(normalizeJson(new WorkerBeeIterable([1, 2])), [1, 2]);
  });

  it("emits integers past 2**53 as strings so an n8n expression cannot round them", () => {
    assert.equal(normalizeJson(10n ** 20n), "100000000000000000000");
    assert.equal(normalizeJson(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
    assert.equal(typeof normalizeJson(Number.MAX_SAFE_INTEGER * 4), "string");
  });

  it("renders dates as ISO-8601", () => {
    assert.equal(normalizeJson(new Date("2026-08-31T10:00:00.000Z")), "2026-08-31T10:00:00.000Z");
  });

  it("drops undefined members rather than emitting null, so IF can test presence", () => {
    assert.deepEqual(normalizeJson({ one: 1, two: undefined }), { one: 1 });
  });

  it("keeps null, because a chain null is a value", () => {
    assert.deepEqual(normalizeJson({ one: null }), { one: null });
  });

  it("walks Maps and Sets", () => {
    assert.deepEqual(normalizeJson(new Map([["one", 1]])), { one: 1 });
    assert.deepEqual(normalizeJson(new Set([1, 2])), [1, 2]);
  });

  it("stringifies anything it does not understand instead of throwing", () => {
    assert.equal(typeof normalizeJson(() => undefined), "string");
  });
});

describe("normalizeNotification", () => {
  it("names manabar keys instead of leaving the enum ordinal", () => {
    const payload = normalizeNotification({ manabarData: { alice: { 2: { percent: 98 } } } });
    assert.deepEqual(payload.manabarData, { alice: { RC: { percent: 98 } } });
  });

  it("names alarm values instead of leaving the enum ordinal", () => {
    const payload = normalizeNotification({ alarmsPerAccount: { alice: new WorkerBeeIterable([3, 4]) } });
    assert.deepEqual(payload.alarmsPerAccount, { alice: ["RECOVERY_ACCOUNT_IS_CHANGING", "DECLINING_VOTING_RIGHTS"] });
  });

  it("leaves payloads without those keys untouched", () => {
    assert.deepEqual(normalizeNotification({ block: { number: 5 } }), { block: { number: 5 } });
  });

  it("covers every member of the enums it renames", async () => {
    /*
     * Against the libraries' own enums, not against a hand-written key list.
     * Counting keys proved only that this file agrees with itself, while the
     * header warns of exactly the failure it could not see: a renumbering in
     * wax or WorkerBee leaves the mapping silently wrong.
     */
    const { EManabarType } = await import("@hiveio/wax");
    const { EAlarmType } = await import("../dist/workerbee/index.mjs");

    const spellings = (members) =>
      Object.fromEntries(
        Object.entries(members)
          .filter(([, value]) => typeof value === "number")
          .map(([name, value]) => [String(value), name]),
      );

    assert.deepEqual(MANABAR_TYPE_NAMES, spellings(EManabarType));
    assert.deepEqual(ALARM_TYPE_NAMES, spellings(EAlarmType));
  });
});

describe("normalizeJson edge cases", () => {
  it("writes a large integer as digits, not as exponential notation", () => {
    /*
     * "1.2345e+21" makes BigInt($json.rshares) throw and defeats any decimal
     * comparison -- the opposite of why big numbers become strings at all. The
     * digits are the exact value of the double, which by then has already lost
     * precision; the point is that nothing downstream loses any more.
     */
    const out = normalizeJson({ rshares: 1.2345e21 });
    assert.equal(/^\d+$/.test(out.rshares), true, `expected plain digits, got ${out.rshares}`);
    assert.equal(BigInt(out.rshares), BigInt(1.2345e21));
  });

  it("unwraps a symbol to its description, not to Symbol(...)", () => {
    /*
     * The library tags known exchanges with symbols; an n8n IF should compare
     * against "Binance", not against the wrapper text.
     */
    assert.equal(normalizeJson({ exchange: Symbol("Binance") }).exchange, "Binance");
  });

  it("does not resolve an enum name through the prototype chain", () => {
    const payload = normalizeNotification({ alarmsPerAccount: { alice: ["constructor", "toString", "2"] } });
    assert.deepEqual(payload.alarmsPerAccount.alice, ["constructor", "toString", "GOVERNANCE_VOTE_EXPIRED"]);
  });
});

describe("normalizeJson keeps the promise its return type makes", () => {
  it("does not overflow the stack on a cycle", () => {
    /*
     * The contract is a finite JSON value, and a RangeError is not one. It was
     * swallowed by EventStream.push into the error counter, so the whole
     * notification produced no items -- seq showing no gap, dropped not moving.
     */
    const self = { name: "block" };
    self.self = self;
    assert.deepEqual(normalizeJson(self), { name: "block", self: null });

    const viaToJson = { toJSON() { return this; } };
    assert.doesNotThrow(() => normalizeJson(viaToJson));

    const [left, right] = [{}, {}];
    left.other = right;
    right.other = left;
    assert.deepEqual(normalizeJson({ left, right }), { left: { other: { other: null } }, right: { other: { other: null } } });
  });

  it("still serialises a value that merely appears twice", () => {
    /*
     * The guard tracks the path from the root, not everything visited: a shared
     * sub-object is not a cycle, and nulling the second occurrence would drop
     * real data. `transactionsPerId` and `transactions` share their entries.
     */
    const shared = { amount: 1 };
    assert.deepEqual(normalizeJson([shared, shared]), [{ amount: 1 }, { amount: 1 }]);
    assert.deepEqual(normalizeJson({ one: shared, two: { three: shared } }), { one: { amount: 1 }, two: { three: { amount: 1 } } });
  });

  it("does not emit NaN or Infinity, which JSON turns into null", () => {
    /*
     * Null is indistinguishable from a key the provider never populated, which
     * is exactly what the docblock says the undefined-dropping exists to avoid.
     */
    assert.equal(normalizeJson(NaN), "NaN");
    assert.equal(normalizeJson(Infinity), "Infinity");
    assert.equal(normalizeJson(-Infinity), "-Infinity");
    assert.deepEqual(JSON.parse(JSON.stringify(normalizeJson({ ratio: NaN }))), { ratio: "NaN" });
  });

  it("hexes a bare ArrayBuffer, not just a view of one", () => {
    /*
     * A bare buffer fell through to Object.entries and became {} -- a silent
     * total loss where the branch above intends hex.
     */
    const view = new Uint8Array([1, 2, 255]);
    assert.equal(normalizeJson(view), "0102ff");
    assert.equal(normalizeJson(view.buffer), "0102ff");
  });
});

describe("a notification that is not an object", () => {
  it("is refused rather than emitted as an empty payload", () => {
    /*
     * `object` includes arrays, so an array notification normalised to [...],
     * failed the plain-record test and was emitted as {} -- no error, no
     * counter, no log.
     */
    assert.throws(() => normalizeNotification([{ one: 1 }]), (error) => /must be an object, got an array/.test(error.message));
  });
});
