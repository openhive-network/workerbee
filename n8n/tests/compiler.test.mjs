import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { recorder, shared } from "./helpers.mjs";

const { compileSpec, parseParams } = shared("compiler");
const { EVENTS_BY_TAG } = shared("events");

const compile = (spec) => {
  const { chain, calls } = recorder();
  compileSpec(chain, spec);
  return calls;
};

describe("compileSpec", () => {
  it("maps one event onto its QueenBee call", () => {
    assert.deepEqual(compile({ match: [[{ event: "posts", authors: ["alice", "bob"] }]] }), [["onPosts", "alice", "bob"]]);
  });

  it("splits a comma-separated list the visual builder produces", () => {
    assert.deepEqual(compile({ match: [[{ event: "posts", authors: "alice, bob" }]] }), [["onPosts", "alice", "bob"]]);
  });

  it("OR-s the entries inside one group without an and", () => {
    const calls = compile({ match: [[{ event: "posts", authors: ["alice"] }, { event: "comments", authors: ["bob"] }]] });
    assert.deepEqual(calls, [
      ["onPosts", "alice"],
      ["onComments", "bob"],
    ]);
  });

  it("starts a new AND operand for every group after the first", () => {
    const calls = compile({ match: [[{ event: "posts", authors: ["alice"] }], [{ event: "votes", voters: ["bob"] }]] });
    assert.deepEqual(calls, [["onPosts", "alice"], ["and"], ["onVotes", "bob"]]);
  });

  it("applies providers after every filter, whatever fired", () => {
    const calls = compile({ match: [[{ event: "block" }]], provide: [{ provide: "block_data" }] });
    assert.deepEqual(calls, [["onBlock"], ["provideBlockData"]]);
  });

  it("coerces numbers and enums out of the strings n8n hands over", () => {
    assert.deepEqual(compile({ match: [[{ event: "accounts_manabar_percent", accounts: "alice", percent: "80", manabar: "rc" }]] }), [
      ["onAccountsManabarPercent", 2, 80, "alice"],
    ]);
  });

  it("keeps a relative offset as text but a millisecond count as a number", () => {
    assert.deepEqual(compile({ match: [[{ event: "posts_incoming_payout", authors: "alice", within: "-1h" }]] }), [
      ["onPostsIncomingPayout", "-1h", "alice"],
    ]);
    assert.deepEqual(compile({ match: [[{ event: "posts_incoming_payout", authors: "alice", within: "3600000" }]] }), [
      ["onPostsIncomingPayout", 3600000, "alice"],
    ]);
  });

  it("applies documented defaults when a parameter is omitted", () => {
    assert.deepEqual(compile({ match: [[{ event: "witnesses_missed_blocks", witnesses: "gtg" }]] }), [["onWitnessesMissedBlocks", 1, "gtg"]]);
    assert.deepEqual(compile({ match: [[{ event: "accounts_balance_change", accounts: "alice" }]] }), [["onAccountsBalanceChange", false, "alice"]]);
  });

  it("parses an object-valued parameter from JSON text", () => {
    const calls = compile({ match: [[{ event: "whale_alert", asset: '{"amount":"100000","precision":3,"nai":"@@000000021"}' }]] });
    assert.deepEqual(calls, [["onWhaleAlert", { amount: "100000", precision: 3, nai: "@@000000021" }]]);
  });
});

describe("compileSpec rejections", () => {
  const fails = (spec, fragment) => {
    assert.throws(() => compile(spec), (error) => error.message.includes(fragment), `expected a failure mentioning ${fragment}`);
  };

  it("names the known events for an unknown one", () => fails({ match: [[{ event: "postz" }]] }, "Known events"));
  it("reports a typo in a parameter name rather than ignoring it", () =>
    fails({ match: [[{ event: "posts", author: "alice" }]] }, 'has no parameter "author"'));
  it("reports a missing required parameter", () => fails({ match: [[{ event: "posts" }]] }, "missing required parameter"));
  it("rejects an out-of-range value", () => fails({ match: [[{ event: "feed_price_change", percent: "150" }]] }, "at most 100"));
  it("rejects a non-integer where an integer is required", () => fails({ match: [[{ event: "block_number", block_number: "1.5" }]] }, "whole number"));
  it("rejects an empty match", () => fails({ match: [] }, "non-empty"));
  it("rejects an empty group", () => fails({ match: [[]] }, "is empty"));
  it("rejects malformed JSON in an object parameter", () => fails({ match: [[{ event: "whale_alert", asset: "{oops" }]] }, "not valid JSON"));

  it("refuses an empty account list instead of silently matching nothing", () => {
    assert.throws(
      () => parseParams(EVENTS_BY_TAG.get("posts"), { event: "posts", authors: [] }),
      (error) => error.message.includes("at least one name"),
    );
  });
});

describe("coercion refuses what it used to silently accept", () => {
  const reject = (entry, expected) =>
    assert.throws(
      () => compileSpec(recorder().chain, { match: [[entry]] }),
      (error) => error.message.includes(expected),
      `${JSON.stringify(entry)} must be rejected`,
    );

  it("will not stringify a non-list into a name", () => {
    /*
     * String(null) is "null", a perfectly plausible Hive account: this used to
     * compile into a subscription that watched an account called "null".
     */
    reject({ event: "posts", authors: null }, "must be a list");
    reject({ event: "posts", authors: true }, "must be a list");
    reject({ event: "impacted_accounts", accounts: { 0: "alice" } }, "must be a list");
    reject({ event: "posts", authors: [{ name: "alice" }] }, "only names");
  });

  it("will not read whitespace or an empty array as the number zero", () => {
    // Percent has min 0, so 0 passed validation and fired on every single block.
    reject({ event: "accounts_manabar_percent", accounts: ["alice"], percent: " " }, "must be a number");
    reject({ event: "accounts_manabar_percent", accounts: ["alice"], percent: [] }, "must be a number");
    reject({ event: "feed_price_change", percent: "" }, "missing required parameter");
  });

  it("validates the numbers inside a NAI asset", () => {
    /*
     * A NaN precision compares false against every asset, so the whale alert
     * simply never fired -- indistinguishable from a quiet week.
     */
    reject({ event: "whale_alert", asset: { amount: "1", precision: "three", nai: "@@000000021" } }, "must be a number");
    reject({ event: "whale_alert", asset: { amount: "1", precision: 3.5, nai: "@@000000021" } }, "whole number");
  });

  it("is strict about booleans in both directions", () => {
    reject({ event: "accounts_balance_change", accounts: ["alice"], include_internal_transfers: "ture" }, "must be true or false");
    const off = compile({ match: [[{ event: "accounts_balance_change", accounts: ["alice"], include_internal_transfers: "no" }]] });
    assert.deepEqual(off, [["onAccountsBalanceChange", false, "alice"]]);
    const on = compile({ match: [[{ event: "accounts_balance_change", accounts: ["alice"], include_internal_transfers: 1 }]] });
    assert.deepEqual(on, [["onAccountsBalanceChange", true, "alice"]]);
  });

  it("rejects an unknown top-level spec key the way it rejects an unknown parameter", () => {
    /*
     * "provides" instead of "provide" used to compile happily into a spec with no
     * providers at all, and the only clue was missing data on the far side.
     */
    assert.throws(
      () => compileSpec(recorder().chain, { match: [[{ event: "block" }]], provides: [{ provide: "block_data" }] }),
      (error) => error.message.includes('no "provides" setting'),
    );
  });
});

describe("the parameter accessors are typed, not just annotated", () => {
  /*
   * All nine used to be one `values.get(name) as T`, so the declared return
   * types were decoration. Both faults below were silent: a subscription that
   * compiles, applies, and then never fires.
   */
  const posts = EVENTS_BY_TAG.get("posts");

  it("refuses a parameter the descriptor does not declare", () => {
    /*
     * A one-character typo in events.ts used to yield `undefined` typed as the
     * declared type, and `onFeedPriceChange(undefined)` never fires.
     */
    const params = parseParams(posts, { event: "posts", authors: ["alice"] });

    assert.throws(() => params.names("authorz"), (error) => error.code === "invalid_spec" && /does not declare/.test(error.message));
  });

  it("refuses an accessor that does not match the field's declared kind", () => {
    /*
     * `params.int("authors")` returned ["alice"] typed as a number and handed it
     * to a numeric filter.
     */
    const params = parseParams(posts, { event: "posts", authors: ["alice"] });

    assert.throws(() => params.int("authors"), (error) => /is declared names/.test(error.message));
    assert.throws(() => params.asset("authors"), (error) => /is declared names/.test(error.message));
    assert.deepEqual(params.names("authors"), ["alice"], "the right accessor still works");
  });
});

describe("a raw JSON spec is checked, not assumed", () => {
  /*
   * These used to reach `resolve()` and come back as bare TypeErrors with no
   * `code`, which breaks the promise errors.ts makes: every error this package
   * raises carries one an Error Trigger can branch on.
   */
  const rejects = (spec, pattern) =>
    assert.throws(
      () => compile(spec),
      (error) => {
        assert.equal(error.code, "invalid_spec", `no code on: ${error.message}`);
        assert.match(error.message, pattern);
        return true;
      },
    );

  it("refuses a null where an event object belongs", () => {
    rejects({ match: [[null]] }, /must be an object/);
    rejects({ match: [[{ event: "posts", authors: ["a"] }, null]] }, /Event #2 of match group #1/);
  });

  it("refuses a match group that is not an array", () => {
    /*
     * An array of objects rather than an array of arrays used to report
     * "Match group #1 is empty", which is not what is wrong with it.
     */
    rejects({ match: [{ event: "block" }] }, /must be an array of events/);
  });

  it("refuses a provide that is not an array of objects", () => {
    rejects({ match: [[{ event: "block" }]], provide: { provide: "block_data" } }, /"provide" must be an array/);
    rejects({ match: [[{ event: "block" }]], provide: 5 }, /"provide" must be an array/);
    rejects({ match: [[{ event: "block" }]], provide: [null] }, /Provider #1 must be an object/);
  });

  it("still accepts the shapes it always did", () => {
    assert.deepEqual(compile({ match: [[{ event: "posts", authors: ["alice"] }]] }), [["onPosts", "alice"]]);
  });
});

describe("coercion refuses two more things it used to accept", () => {
  const compileOne = (entry) => compile({ match: [[entry]] });

  it("refuses a payout window without the leading minus, which used to mean NaN", () => {
    /*
     * CalculateRelativeTime only parses "-Nd|h|m|s". Anything else goes to wax's
     * dateFromString, which is `new Date(s+"Z")` and does not throw: "1h" became
     * an Invalid Date, then NaN, and every comparison against NaN is false -- so
     * the subscription simply never fired. "1h" is the obvious thing to type
     * under a label reading "How close to payout".
     */
    for (const bad of ["1h", "60m", "1 hour", "soon"])
      assert.throws(
        () => compileOne({ event: "posts_incoming_payout", authors: ["alice"], within: bad }),
        (error) => error.code === "invalid_spec" && /needs the leading minus|must be milliseconds/.test(error.message),
        `"${bad}" must not compile`,
      );
  });

  it("still takes every form WorkerBee really parses", () => {
    for (const good of ["-1h", "-30s", "-15m", "-7d", 3600000, "3600000"])
      assert.deepEqual(compileOne({ event: "posts_incoming_payout", authors: ["alice"], within: good }), [
        ["onPostsIncomingPayout", typeof good === "number" || /^\d+$/.test(String(good)) ? Number(good) : good, "alice"],
      ]);
  });
});

describe("asset coercion keeps what the chain needs", () => {
  const whale = (amount, nai) => ({ event: "whale_alert", asset: { amount, precision: 3, nai } });
  const applied = (entry) => compile({ match: [[entry]] })[0];

  it("refuses a nai that is not one, instead of stringifying it", () => {
    /*
     * `String(null)` is "null". A nai no asset carries makes a whale alert that
     * never fires -- the same class as an account called "null", from the other
     * side. It survived the `=== undefined` check, so it needed its own.
     */
    for (const bad of [null, 21, "@@21", "HIVE", ""])
      assert.throws(() => applied(whale("100000", bad)), (error) => /"nai" must be an asset identifier/.test(error.message), `nai ${JSON.stringify(bad)}`);
  });

  it("keeps a large amount exact instead of routing it through Number", () => {
    /*
     * Above 2^53 a round trip loses digits; above 1e21 it produces "1e+21",
     * which is not an amount. VESTS at precision 6 reaches both in normal use.
     */
    assert.equal(applied(whale("9007199254740993", "@@000000037"))[1].amount, "9007199254740993");
    assert.equal(applied(whale("1000000000000000000000", "@@000000037"))[1].amount, "1000000000000000000000");
  });

  it("still accepts what it always did", () => {
    assert.deepEqual(applied(whale("100000", "@@000000021"))[1], { amount: "100000", precision: 3, nai: "@@000000021" });
    assert.equal(applied(whale(100000, "@@000000021"))[1].amount, "100000", "the Raw JSON field produces a number");
  });
});

describe("account names are checked against what the chain can issue", () => {
  it("refuses a value no account could have", () => {
    /*
     * Names are matched by set membership, so anything unissuable simply never
     * matches. `authors: "alice bob"` -- a space where a comma belongs -- became
     * one name nobody has, and the subscription looked like a quiet chain.
     */
    for (const bad of ["alice bob", "Alice", "ab", "alice_bob", "a".repeat(17)])
      assert.throws(
        () => compile({ match: [[{ event: "posts", authors: bad }]] }),
        (error) => /is not a Hive account name/.test(error.message),
        `"${bad}" must not compile`,
      );
  });

  it("accepts the dotted and hyphenated names Hive really issues", () => {
    assert.deepEqual(compile({ match: [[{ event: "posts", authors: "hive.fund,peak-snaps,neight.tester1" }]] }), [
      ["onPosts", "hive.fund", "peak-snaps", "neight.tester1"],
    ]);
  });

  it("leaves transaction and custom_json ids alone, which are not account names", () => {
    /*
     * They shared the `names` kind with account fields, which is what had to be
     * separated before names could be checked at all.
     */
    assert.deepEqual(compile({ match: [[{ event: "transaction_ids", transaction_ids: "ABC123,dead-BEEF" }]] }), [
      ["onTransactionIds", "ABC123", "dead-BEEF"],
    ]);
    assert.deepEqual(compile({ match: [[{ event: "custom_operation", ids: "sm_claim_reward,SPS" }]] }), [["onCustomOperation", "sm_claim_reward", "SPS"]]);
  });
});
