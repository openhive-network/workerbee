/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onFeedPriceChange() — monitor when feed price changes by percentage.
 *
 * The onFeedPriceChange observer triggers when the Hive price feed changes
 * by a specified percentage threshold.
 *
 * Data Types & IDE IntelliSense:
 * - `percentThreshold` (number): Minimum percentage change to trigger
 * - `data`: Price change information with old/new values
 * - IDE shows all available price data properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for price changes (5%+)...");

bot.observe.onFeedPriceChange(5).subscribe({
  next() {
    console.log("📈 Price changed");
  },
  error: console.error
});
