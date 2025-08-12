/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onCustomOperation() — monitor custom JSON operations by ID.
 *
 * The onCustomOperation observer triggers when custom_json operations with
 * specified IDs occur. Used by dApps and games like Splinterlands, PeakD, etc.
 *
 * Data Types & IDE IntelliSense:
 * - `ids` (string[]): Custom operation IDs to monitor (e.g., "follow", "reblog")
 * - `data.customOperations`: Custom operations grouped by ID
 * - IDE shows all available custom operation properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for custom operations...");

bot.observe.onCustomOperation("follow", "reblog", "sm_claim_reward").subscribe({
  next(data) {
    console.log("🔧 Custom operation detected:", data);
  },
  error: console.error
});
