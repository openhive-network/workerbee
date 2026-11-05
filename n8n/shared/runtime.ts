/**
 * The timers WorkerBee runs on inside n8n.
 *
 * A community node must not touch `setInterval` / `setTimeout` itself, so the block
 * poller and the delays of the bot are loops over `sleep` of n8n-workflow, stopped
 * through its abort signal. The signal is checked after every sleep as well: the
 * `sleep` of older n8n versions takes no signal.
 */
import { sleep } from "n8n-workflow";
import type { IWorkerBeeRuntime } from "../workerbee/n8n/workerbee-n8n/index";

export const n8nRuntime = (version: string): IWorkerBeeRuntime => ({
  every: (callback, intervalMs) => {
    const abort = new AbortController();
    void (async () => {
      for (;;) {
        try {
          await sleep(intervalMs, abort.signal);
        } catch {
          return; // Stopped
        }
        if (abort.signal.aborted) return;
        callback();
      }
    })();
    return () => abort.abort();
  },
  after: (callback, delayMs) => {
    const abort = new AbortController();
    sleep(delayMs, abort.signal).then(
      () => {
        if (!abort.signal.aborted) callback();
      },
      () => undefined,
    );
    return () => abort.abort();
  },
  version,
});
