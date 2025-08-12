/* eslint-disable no-console */
/**
 * Category: 🔐 Security & Governance
 * Demo: onWitnessesMissedBlocks() — monitor when witnesses miss blocks.
 *
 * The onWitnessesMissedBlocks observer triggers when specified witnesses
 * miss a certain number of blocks, useful for monitoring network health.
 *
 * Data Types & IDE IntelliSense:
 * - `missedCount` (number): Number of missed blocks to trigger on
 * - `data`: Witness missed block information
 * - IDE shows all available witness data properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for witnesses missing blocks...");

bot.observe.onWitnessesMissedBlocks(1, "gtg").subscribe({
  next() {
    console.log("🧭 Witness missed blocks");
  },
  error: console.error
});
