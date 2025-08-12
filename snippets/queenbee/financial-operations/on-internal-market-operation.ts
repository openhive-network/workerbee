/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onInternalMarketOperation() — monitor internal market activity.
 *
 * The onInternalMarketOperation observer monitors the Hive internal market
 * for limit order creation, cancellation, and order fills.
 *
 * Data Types & IDE IntelliSense:
 * - Monitors HIVE ↔ HBD trading activity
 * - `data`: Internal market operation data
 * - IDE shows all available market operation properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for internal market operations...");

bot.observe.onInternalMarketOperation().subscribe({
  next(data) {
    data.internalMarketOperations.forEach(({ operation }) => {
      console.log(`🏪 Market operation: ${operation.owner}, ${operation.orderId}, ${operation.cancel}`);
    });
  },
  error: console.error
});
