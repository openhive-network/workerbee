/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onInternalMarketOperation() — monitor internal market activity.
 *
 * This observer monitors the Hive internal market for limit order creation,
 * cancellation, and order fills. Tracks HIVE ↔ HBD trading activity on the
 * built-in decentralized exchange.
 *
 * Filter Function Inputs:
 * - No parameters required (monitors all internal market operations)
 *
 * Callback Data:
 * The callback receives data of type {@link IInternalMarketProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for internal market operations...");

bot.observe.onInternalMarketOperation().subscribe({
  /*
   * This observer will trigger when internal market operations occur (order create/cancel/fill).
   * The callback receives data of type {@link IInternalMarketProviderData}, which includes:
   * - `data.internalMarketOperations` - Array of market transaction/operation pairs (create/cancel/fill)
   * Each transaction/operation follows either {@link IInternalMarketCreateOperation}.
   */
  next(data) {
    data.internalMarketOperations.forEach(({ operation }) => {
      console.log(`🏪 Market operation: ${operation.owner}, order ${operation.orderId}`);
    });
  },
  error: console.error
});
