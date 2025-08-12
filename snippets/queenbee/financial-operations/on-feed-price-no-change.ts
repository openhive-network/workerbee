/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onFeedPriceNoChange() — monitor when feed price stays stable.
 *
 * The onFeedPriceNoChange observer triggers when the Hive price feed
 * remains stable (unchanged) for a specified number of hours.
 *
 * Data Types & IDE IntelliSense:
 * - `hours` (number): Number of hours of price stability to monitor
 * - `data`: Price stability information
 * - IDE shows all available stability data properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for price stability (24h+)...");

bot.observe.onFeedPriceNoChange(24).subscribe({
  next() {
    console.log("🧊 Price stable for 24h");
  },
  error: console.error
});
