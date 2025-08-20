/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onFeedPriceChange() — monitor when feed price changes by percentage.
 *
 * This observer triggers when the Hive price feed changes by a specified percentage
 * threshold. Useful for monitoring significant market movements and price volatility.
 *
 * Filter Function Inputs:
 * - `percentThreshold: number` - Minimum percentage change required to trigger (e.g., 5 for 5%)
 *
 * Callback Data:
 * The callback receives no data.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for price changes (5%+)...");

bot.observe.onFeedPriceChange(5).subscribe({
  /*
   * This observer will trigger when the Hive price feed changes by 5% or more.
   * The callback receives no data.
   */
  next() {
    console.log("📈 Price changed by 5%+");
  },
  error: console.error
});
