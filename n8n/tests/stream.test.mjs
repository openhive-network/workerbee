import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { EventStream } = shared("stream");

const notification = (count) => ({ block: { number: count, id: `id-${count}` } });

describe("EventStream", () => {
  it("never blocks and never throws when nobody is consuming", () => {
    const stream = new EventStream("sub", { maxQueue: 2 });
    for (let i = 0; i < 100; i++) stream.push(notification(i));
    assert.equal(stream.pending, 2);
    assert.equal(stream.dropped, 98);
  });

  it("drops the oldest item by default, keeping the freshest chain state", async () => {
    const stream = new EventStream("sub", { maxQueue: 2, overflow: "drop_oldest" });
    for (const count of [1, 2, 3]) stream.push(notification(count));
    const first = await stream.get();
    assert.equal(first.blockNum, 2);
    assert.equal(stream.dropped, 1);
  });

  it("can drop the newest instead, keeping the oldest backlog", async () => {
    const stream = new EventStream("sub", { maxQueue: 2, overflow: "drop_newest" });
    for (const count of [1, 2, 3]) stream.push(notification(count));
    const first = await stream.get();
    assert.equal(first.blockNum, 1);
    assert.equal(stream.dropped, 1);
  });

  it("keeps the bound when max_queue is not a usable number", () => {
    /*
     * `max_queue` reaches the stream straight from the Raw JSON field. NaN used to
     * make every `length >= maxQueue` comparison false and silently remove the
     * bound this class exists to enforce.
     */
    for (const bad of ["abc", NaN, 0, -5, undefined, null]) {
      const stream = new EventStream("sub", { maxQueue: bad });
      for (let i = 0; i < 600; i++) stream.push(notification(i));
      assert.equal(stream.pending, 500, `max_queue ${JSON.stringify(bad)} must fall back to the default bound`);
    }
  });

  it("treats an unknown overflow policy as drop_oldest rather than as itself", async () => {
    const stream = new EventStream("sub", { maxQueue: 2, overflow: "drop_everything" });
    for (const count of [1, 2, 3]) stream.push(notification(count));
    assert.equal((await stream.get()).blockNum, 2);
  });

  it("refuses a second concurrent consumer instead of stranding the first", async () => {
    const stream = new EventStream("sub");
    const first = stream.get();
    await assert.rejects(stream.get(), /already has a consumer/);
    stream.push(notification(3));
    assert.equal((await first).blockNum, 3);
  });

  it("hands an item straight to a waiting consumer", async () => {
    const stream = new EventStream("sub");
    const pending = stream.get();
    stream.push(notification(7));
    assert.equal((await pending).blockNum, 7);
    assert.equal(stream.pending, 0);
    assert.equal(stream.emitted, 1);
  });

  it("counts pipeline errors instead of raising them into the block loop", () => {
    const stream = new EventStream("sub");
    stream.pushError(new Error("boom"));
    assert.equal(stream.errors, 1);
    assert.equal(stream.lastError.message, "boom");
  });

  it("releases a parked consumer on close so a drain loop can finish", async () => {
    const stream = new EventStream("sub");
    const pending = stream.get();
    stream.close();
    assert.equal(await pending, null);
    assert.equal(stream.isClosed, true);
  });

  it("ignores pushes after close", () => {
    const stream = new EventStream("sub");
    stream.close();
    stream.push(notification(1));
    assert.equal(stream.pending, 0);
  });
});
