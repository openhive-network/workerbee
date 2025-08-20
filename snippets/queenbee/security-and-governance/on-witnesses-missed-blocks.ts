/* eslint-disable no-console */
/**
 * Category: 🔐 Security & Governance
 * Demo: onWitnessesMissedBlocks() — monitor when witnesses miss blocks.
 *
 * This observer triggers when specified witnesses miss a certain number of blocks.
 * Essential for monitoring network health and witness performance. Can track
 * multiple witnesses simultaneously.
 *
 * Filter Function Inputs:
 * - `missedCount: number` - Number of missed blocks required to trigger
 * - `...witnesses: TAccountName[]` - Witness account names to monitor for missed blocks
 *
 * Callback Data:
 * There is no callback data for this observer.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for witnesses missing blocks...");

bot.observe.onWitnessesMissedBlocks(1, "guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when guest4test or guest4test1 (as witnesses) miss 1 or more blocks.
   * This filter monitors witness performance and network health by tracking missed block production.
   * There is no callback data for this observer - it simply notifies when the threshold is reached.
   */
  next() {
    console.log("🧭 A witness has missed blocks");
  },
  error: console.error
});
