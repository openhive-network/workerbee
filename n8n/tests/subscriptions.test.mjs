import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { closePrevious, forget, remember, subscribedNodes } = shared("subscriptions");

/** A close function that records that it ran. */
const recording = (log, name) => {
  const close = async () => {
    log.push(name);
  };
  return close;
};

describe("live subscription registry", () => {
  it("closes the previous subscription when a node re-activates", async () => {
    /*
     * The bug this exists for: n8n keeps only the newest closeFunction, so the
     * first subscription became unreachable -- its bot reference was never
     * dropped, the poller never stopped, and every event was handled twice.
     */
    const log = [];
    const key = "workflow-1:node-a";

    const first = recording(log, "first");
    remember(key, first);

    await closePrevious(key);
    assert.deepEqual(log, ["first"], "re-activating must close what was already running");
    assert.deepEqual(subscribedNodes(), [], "and leave nothing registered under that key");

    const second = recording(log, "second");
    remember(key, second);
    assert.deepEqual(subscribedNodes(), [key]);

    await second();
    forget(key, second);
    assert.deepEqual(log, ["first", "second"]);
    assert.deepEqual(subscribedNodes(), []);
  });

  it("does nothing for a node that is not subscribed", async () => {
    await closePrevious("workflow-1:never-activated");
    assert.deepEqual(subscribedNodes(), []);
  });

  it("keeps the node out of the registry even when its close throws", async () => {
    /*
     * Leaving the entry would make the next activation try to close it again,
     * and a close that already failed is not going to succeed the second time.
     */
    const key = "workflow-2:node-b";
    remember(key, async () => {
      throw new Error("unsubscribe blew up");
    });

    await closePrevious(key);
    assert.deepEqual(subscribedNodes(), [], "a failed close must not block the re-activation");
  });

  it("does not let a superseded close evict the live subscription", async () => {
    /*
     * Without the identity guard a late close from the old subscription would
     * delete the new one's entry, and the next activation would find nothing to
     * close -- reopening the leak.
     */
    const log = [];
    const key = "workflow-3:node-c";

    const stale = recording(log, "stale");
    remember(key, stale);

    const live = recording(log, "live");
    remember(key, live);

    forget(key, stale);
    assert.deepEqual(subscribedNodes(), [key], "the live subscription must still be registered");

    await closePrevious(key);
    assert.deepEqual(log, ["live"], "and it must be the one that gets closed");
  });

  it("tracks each node separately", async () => {
    const log = [];
    remember("workflow-4:node-d", recording(log, "d"));
    remember("workflow-4:node-e", recording(log, "e"));

    assert.deepEqual(subscribedNodes(), ["workflow-4:node-d", "workflow-4:node-e"]);

    await closePrevious("workflow-4:node-d");
    assert.deepEqual(log, ["d"], "closing one node must not touch the other");
    assert.deepEqual(subscribedNodes(), ["workflow-4:node-e"]);

    await closePrevious("workflow-4:node-e");
  });
});
