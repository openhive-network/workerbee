/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onWhaleAlert() — monitor large transfers above a threshold.
 *
 * The onWhaleAlert observer triggers when transfers exceed a specified amount
 * threshold, useful for monitoring large financial movements.
 *
 * Data Types & IDE IntelliSense:
 * - Uses asset objects created by `bot.chain.hiveCoins(amount)`
 * - `data.whaleOperations`: Array of large transfer operations
 * - IDE shows all available whale operation properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

// Monitor transfers of 1000 HIVE or more
const threshold = bot.chain!.hiveCoins(1000);

console.log("⏳ Watching for whale transfers (1000+ HIVE)...");

bot.observe.onWhaleAlert(threshold).subscribe({
  next(data) {
    data.whaleOperations.forEach(({ operation }) => {
      console.log(`🐋 Whale alert: ${operation.from} -> ${operation.to} (${operation.amount})`);
    });
  },
  error: console.error
});
