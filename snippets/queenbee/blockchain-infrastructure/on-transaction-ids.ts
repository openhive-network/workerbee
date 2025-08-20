/* eslint-disable no-console */
/**
 * Category: ⚙️ Blockchain Infrastructure
 * Demo: onTransactionIds() — monitor specific transaction IDs.
 *
 * This observer triggers when specific transaction IDs appear on the blockchain.
 * Useful for tracking specific transactions and their inclusion in blocks.
 *
 * Filter Function Inputs:
 * - `...transactionIds: string[]` - Transaction IDs to monitor
 *
 * Callback Data:
 * The callback receives data of type {@link ITransactionProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for specific transaction IDs...");

// Example transaction IDs (replace with actual ones)
bot.observe.onTransactionIds("example-tx-id-1", "example-tx-id-2").subscribe({
  /*
   * This observer will trigger when any of the specified transaction IDs appear on the blockchain.
   * The callback receives data of type {@link ITransactionProviderData}, which includes:
   * - `data.transactions` - Contains transaction data for each found transaction ID
   * All transaction IDs will be present in the data object, but those not found will have undefined values.
   * You should check for the existence of each transaction before accessing its properties when observing multiple IDs.
   */
  next(data) {
    if (data.transactions["example-tx-id-1"])
      console.log("🔍 Transaction found: example-tx-id-1");
  },
  error: console.error
});
