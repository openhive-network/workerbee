/*
 * The timers WorkerBee runs on inside n8n: loops over `sleep` of n8n-workflow.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { n8nRuntime } = shared("runtime");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("n8nRuntime", () => {
  const runtime = n8nRuntime("1.2.3");

  it("calls back every interval until stopped", async () => {
    let calls = 0;
    const stop = runtime.every(() => ++calls, 10);

    await wait(65);
    stop();
    const atStop = calls;
    await wait(40);

    assert.ok(atStop >= 3, `expected a few calls, got ${atStop}`);
    assert.equal(calls, atStop, "no call after stop");
  });

  it("calls back once after the delay, or never when cancelled", async () => {
    const called = [];
    runtime.after(() => called.push("kept"), 10);
    const cancel = runtime.after(() => called.push("cancelled"), 10);
    cancel();

    await wait(40);

    assert.deepEqual(called, ["kept"]);
  });

  it("reports the version it was given", () => {
    assert.equal(runtime.version, "1.2.3");
  });
});
