import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { fakeBots, shared } from "./helpers.mjs";

const { botPool, BotPool, DEFAULT_ENDPOINT, normalizeEndpoint } = shared("chain");

const ENDPOINT = "https://api.hive.blog/";
const OTHER = "https://api.openhive.network/";

describe("botPool lifecycle", () => {
  /*
   * A recording factory, so these assert what the pool *did* rather than what it
   * wrote down about itself. The previous versions read `botPool.polling`, a flag
   * the pool sets on the line next to the call it was meant to witness: deleting
   * `bot.start()` and `bot.stop()` outright left them green.
   *
   * It also takes them off the network. The old header claimed they never made a
   * request; that was true of `withChain` and false of `acquire`, which built a
   * real chain and a real WorkerBee whose `start()` polls the endpoint every two
   * seconds for as long as the file runs.
   */

  it("starts the block poller once for two triggers and stops it on the last release", async () => {
    const { factory, calls } = fakeBots();
    const pool = new BotPool(factory);

    const first = await pool.acquire(ENDPOINT);
    const second = await pool.acquire(ENDPOINT);
    assert.deepEqual(calls, [["start", ENDPOINT]], "two triggers, one block stream");
    assert.equal(second.bot, first.bot);

    first.release();
    assert.deepEqual(calls, [["start", ENDPOINT]], "still one subscriber left");

    second.release();
    assert.deepEqual(calls, [
      ["start", ENDPOINT],
      ["stop", ENDPOINT],
    ]);
  });

  it("restarts the poller for a later trigger, despite WorkerBee.running staying true", async () => {
    const { factory, verbs } = fakeBots();
    const pool = new BotPool(factory);

    (await pool.acquire(ENDPOINT)).release();
    (await pool.acquire(ENDPOINT)).release();

    assert.deepEqual(verbs(), ["start", "stop", "start", "stop"], "the second trigger must get a running poller of its own");
  });

  it("does not poll for a plain chain read", async () => {
    const { factory, calls } = fakeBots();
    const pool = new BotPool(factory);

    const seen = await pool.withChain(ENDPOINT, async (chain) => chain.endpoint);
    assert.equal(seen, ENDPOINT);
    assert.deepEqual(calls, [], "a one-shot read must never start the block stream");
    assert.equal(pool.endpoints.includes(ENDPOINT), true, "but the chain stays warm");
  });

  it("ignores a double release rather than dropping somebody else's reference", async () => {
    const { factory, calls } = fakeBots();
    const pool = new BotPool(factory);

    const handle = await pool.acquire(ENDPOINT);
    const other = await pool.acquire(ENDPOINT);
    handle.release();
    handle.release();
    assert.deepEqual(calls, [["start", ENDPOINT]], "the second release must not stop a poller somebody still holds");

    other.release();
    assert.deepEqual(calls, [
      ["start", ENDPOINT],
      ["stop", ENDPOINT],
    ]);
  });

  it("keeps one bot per endpoint", async () => {
    const { factory, calls } = fakeBots();
    const pool = new BotPool(factory);

    const first = await pool.acquire(ENDPOINT);
    const second = await pool.acquire(OTHER);
    assert.notEqual(first.bot, second.bot);
    assert.deepEqual(pool.endpoints, [ENDPOINT, OTHER].sort());
    assert.deepEqual(calls, [
      ["start", ENDPOINT],
      ["start", OTHER],
    ]);

    first.release();
    second.release();
  });

  it("shares one bot between triggers that activate at the same time", async () => {
    const { factory, calls, created } = fakeBots();
    const pool = new BotPool(factory);

    /*
     * Both miss the cache, so without the in-flight promise in `open()` each
     * would build its own chain and the first would leak.
     */
    const [first, second] = await Promise.all([pool.acquire(ENDPOINT), pool.acquire(ENDPOINT)]);

    assert.equal(created.length, 1, "a concurrent activation must not open a second chain");
    assert.equal(first.bot, second.bot);
    assert.deepEqual(calls, [["start", ENDPOINT]]);

    first.release();
    second.release();
  });

  it("closes everything on shutdown, including entries a trigger still holds", async () => {
    const { factory, verbs } = fakeBots();
    const pool = new BotPool(factory);

    const handle = await pool.acquire(ENDPOINT);
    pool.closeAll();

    assert.deepEqual(verbs(), ["start", "stop", "bot.delete", "chain.delete"]);
    assert.deepEqual(pool.endpoints, []);

    /*
     * The trigger's own close still runs afterwards and must find the entry gone
     * rather than stopping a bot that has already been freed.
     */
    handle.release();
    assert.deepEqual(verbs(), ["start", "stop", "bot.delete", "chain.delete"], "a late release must not touch the freed bot");
  });
});

describe("botPool holds the chain across a read", () => {
  after(() => botPool.closeAll());

  it("leases the endpoint only while the read is in flight", async () => {
    /*
     * The real pool here: this asserts the lease bookkeeping, which is the
     * pool's own state rather than a claim about the bot, and `withChain`
     * genuinely performs no request.
     */
    let leasedDuring;
    await botPool.withChain(ENDPOINT, async () => {
      leasedDuring = botPool.leased;
    });

    assert.deepEqual(leasedDuring, [ENDPOINT], "the endpoint must be leased while the callback runs");
    assert.deepEqual(botPool.leased, [], "and released again the moment it returns");
  });
});

describe("endpoint normalisation", () => {
  it("falls back to the public node for a blank endpoint", () => {
    assert.equal(normalizeEndpoint(""), DEFAULT_ENDPOINT);
    assert.equal(normalizeEndpoint(undefined), DEFAULT_ENDPOINT);
    assert.equal(normalizeEndpoint("  https://x/  "), "https://x/");
  });
});

describe("the endpoint this package quotes back", () => {
  it("strips userinfo, which would otherwise travel into every item and log line", () => {
    /*
     * A private API node is the case the hiveApi credential exists for, and the
     * endpoint is echoed into output items, error headlines and two log lines.
     */
    assert.equal(normalizeEndpoint("https://user:secret@node.example/"), "https://node.example/");
    assert.equal(normalizeEndpoint("https://token@node.example/rpc"), "https://node.example/rpc");
  });

  it("leaves an ordinary endpoint exactly as written", () => {
    assert.equal(normalizeEndpoint("https://api.hive.blog/"), "https://api.hive.blog/");
    assert.equal(normalizeEndpoint("not a url"), "not a url", "deciding what is valid is not this function's job");
  });
});
