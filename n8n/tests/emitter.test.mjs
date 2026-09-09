import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { EventEmitter, OPERATION_GROUPS } = shared("emitter");

const pair = (operation, id) => ({ operation, transaction: { id } });

const BLOCK = { block: { number: 42, id: "0x2a" } };

describe("notification mode", () => {
  it("emits one item carrying the whole merged payload", () => {
    const items = new EventEmitter("sub", "notification").build({ ...BLOCK, votes: { alice: [pair({ vote: {} }, "tx1")] } });
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "notification");
    assert.equal(items[0].blockNum, 42);
    assert.equal(items[0].blockId, "0x2a");
    assert.deepEqual(Object.keys(items[0].payload).sort(), ["block", "votes"]);
  });
});

describe("operation mode", () => {
  it("emits one item per operation and unwraps the operation body", () => {
    const items = new EventEmitter("sub", "operation").build({
      ...BLOCK,
      votes: { alice: [pair({ vote: { weight: 1 } }, "tx1"), pair({ vote: { weight: 2 } }, "tx2")] },
    });
    assert.equal(items.length, 2);
    assert.deepEqual(items.map((item) => item.group), ["votes", "votes"]);
    assert.deepEqual(items.map((item) => item.account), ["alice", "alice"]);
    assert.deepEqual(items.map((item) => item.transactionId), ["tx1", "tx2"]);
    assert.deepEqual(items[0].operation, { vote: { weight: 1 } });
  });

  it("explodes flat operation lists without an account", () => {
    const items = new EventEmitter("sub", "operation").build({ whaleOperations: [pair({ transfer: {} }, "tx9")] });
    assert.equal(items[0].account, null);
    assert.equal(items[0].transactionId, "tx9");
    assert.equal(items[0].group, "whaleOperations");
  });

  it("keeps mention bodies, which carry no transaction wrapper", () => {
    const items = new EventEmitter("sub", "operation").build({ mentioned: { alice: [{ author: "bob", permlink: "hi" }] } });
    assert.equal(items[0].transactionId, null);
    assert.deepEqual(items[0].operation, { author: "bob", permlink: "hi" });
  });

  it("falls back to one notification item when nothing is explodable", () => {
    const items = new EventEmitter("sub", "operation").build({ ...BLOCK, accounts: { alice: { balance: 1 } } });
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "notification");
  });
});

describe("envelope", () => {
  it("numbers items per subscription so a consumer can detect gaps", () => {
    const emitter = new EventEmitter("sub", "notification");
    assert.deepEqual([emitter.build({})[0].seq, emitter.build({})[0].seq, emitter.build({})[0].seq], [1, 2, 3]);
  });

  it("reports no block identity when no provider supplied one", () => {
    const [item] = new EventEmitter("sub", "notification").build({});
    assert.equal(item.blockNum, null);
    assert.equal(item.blockId, null);
  });

  it("lists only WorkerBee payload keys that carry operations", () => {
    const stateKeys = ["accounts", "rcAccounts", "witnesses", "manabarData", "feedPrice", "postsMetadata", "commentsMetadata", "transactions"];
    for (const key of stateKeys) assert.ok(!OPERATION_GROUPS.some((group) => group.key === key), `${key} must not be exploded`);
  });
});

describe("group kinds match what the providers actually produce", () => {
  /*
   * The old test only asserted that state keys were absent from OPERATION_GROUPS.
   * Nothing checked that a group's declared kind matched its producer's shape,
   * which is how `customOperations` spent this whole branch keyed by a
   * custom_json app id while being classified as account-keyed.
   */
  const build = (payload) => new EventEmitter("sub", "operation").build(payload);

  it("fills account for the groups WorkerBee really keys by account", () => {
    const accountKeyed = {
      votes: { alice: [{ operation: { voter: "alice" }, transaction: { id: "t1" } }] },
      posts: { bob: [{ operation: { author: "bob" }, transaction: { id: "t2" } }] },
      impactedAccounts: { carol: [{ operation: { one: 1 }, transaction: { id: "t3" } }] },
      follows: { dave: [{ operation: { two: 2 }, transaction: { id: "t4" } }] },
      mentioned: { erin: [{ body: "hi" }] },
      alarmsPerAccount: { frank: [0] },
    };

    for (const [group, byAccount] of Object.entries(accountKeyed)) {
      const [account] = Object.keys(byAccount);
      const [item] = build({ [group]: byAccount });

      assert.equal(item.group, group);
      assert.equal(item.account, account, `${group} is account-keyed and must fill account`);
      assert.equal(item.key, undefined, `${group} must not carry a key`);
    }
  });

  it("puts the custom_json app id in key rather than pretending it is an account", () => {
    const [item] = build({
      customOperations: { sm_claim_reward: [{ operation: { id: "sm_claim_reward", json: "{}" }, transaction: { id: "t9" } }] },
    });

    assert.equal(item.group, "customOperations");
    assert.equal(item.key, "sm_claim_reward");
    assert.equal(item.account, null, "an app id is not an account name, and a workflow filtering on account must not match it");
    assert.equal(item.transactionId, "t9", "it is still a pair, so the transaction id survives");
  });

  it("leaves account null for the groups that are flat lists", () => {
    for (const group of ["whaleOperations", "exchangeTransferOperations", "internalMarketOperations"]) {
      const [item] = build({ [group]: [{ operation: { amount: 1 }, transaction: { id: "t5" } }] });
      assert.equal(item.account, null, `${group} is a flat list with no account to attribute it to`);
      assert.equal(item.transactionId, "t5");
    }

    const [created] = build({ newAccounts: [{ name: "newbie" }] });
    assert.equal(created.account, null);
    assert.equal(created.transactionId, null, "new accounts arrive without a transaction");
  });
});

describe("provider data in operation mode", () => {
  const payload = {
    block: { number: 42, id: "0x2a", timestamp: "2026-09-09T00:00:00", witness: "gtg" },
    votes: { alice: [{ operation: { voter: "alice", weight: 100 }, transaction: { id: "abc" } }] },
    accounts: { alice: { recoveryAccount: "steem" } },
    feedPrice: { current: 0.3 },
  };

  it("carries every non-exploded key onto the operation item", () => {
    /*
     * The user added those providers to enrich the item. Notification mode hands
     * them over under `payload`; operation mode used to drop them on the floor
     * the moment one group exploded, with no error, no counter and no log.
     */
    const [item] = new EventEmitter("sub", "operation").build(payload);

    assert.equal(item.group, "votes");
    assert.deepEqual(item.context.accounts, { alice: { recoveryAccount: "steem" } });
    assert.deepEqual(item.context.feedPrice, { current: 0.3 });
    assert.equal(item.context.votes, undefined, "the exploded group must not be repeated in the context");
  });

  it("keeps the rest of the block, which the envelope only half carries", () => {
    const [item] = new EventEmitter("sub", "operation").build(payload);

    assert.equal(item.blockNum, 42, "the envelope still lifts the number");
    assert.equal(item.context.block.witness, "gtg", "and the context keeps what it did not lift");
  });

  it("omits the field entirely when nothing is left over", () => {
    const [item] = new EventEmitter("sub", "operation").build({ votes: payload.votes });

    assert.ok(!("context" in item), "an absent key is what an IF node can test for");
  });

  it("shares one context across the items of a notification rather than copying it", () => {
    const many = {
      ...payload,
      votes: { alice: [{ operation: { seq: 1 } }, { operation: { seq: 2 } }], bob: [{ operation: { seq: 3 } }] },
    };
    const items = new EventEmitter("sub", "operation").build(many);

    assert.equal(items.length, 3);
    for (const item of items) assert.equal(item.context, items[0].context, "repeating the payload per item would be quadratic");
  });
});

describe("emit mode", () => {
  const { emitMode } = shared("emitter");

  it("refuses a mode it does not know instead of defaulting to operation", () => {
    /*
     * `build` only tested `mode === "notification"`, so "Notification" with a
     * capital N produced operation-shaped items with no payload key and broke
     * every $json.payload.* expression, silently.
     */
    for (const bad of ["Notification", "notifications", "notification ", ""])
      assert.throws(() => emitMode(bad), (error) => error.message.includes("Unknown emit mode"));

    assert.equal(emitMode("notification"), "notification");
    assert.equal(emitMode("operation"), "operation");
  });
});
