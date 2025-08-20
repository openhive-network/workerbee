/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onFeedPriceNoChange() — monitor when feed price stays stable.
 *
 * This observer triggers when the Hive price feed remains stable (unchanged)
 * for a specified number of hours. Useful for detecting periods of low volatility.
 *
 * Filter Function Inputs:
 * - `hours: number` - Number of hours of required price stability to trigger
 *
 * Callback Data:
 * The callback receives no data.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for price stability (24h+)...");

bot.observe.onFeedPriceNoChange(24).subscribe({
  /*
   * This observer will trigger when the Hive price feed remains stable for 24 hours.
   * The callback receives no data.
   */
  next() {
    console.log("🧊 Price stable for 24h");
  },
  error: console.error
});
