/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onWhaleAlert() — monitor large transfers above a threshold.
 *
 * This observer triggers when transfers exceed a specified amount threshold,
 * useful for monitoring large financial movements on the blockchain.
 * The threshold can be specified for any supported asset type.
 *
 * Filter Function Inputs:
 * - `threshold: asset` - Minimum transfer amount to trigger alert (use bot.chain.hiveCoins() or similar)
 *
 * Callback Data:
 * The callback receives data of type {@link IWhaleAlertProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

/*
 * Monitor transfers of 1000 HIVE or more
 * Remember that chain is available only after calling `start` method.
 */
const threshold = bot.chain!.hiveCoins(1000);

console.log("⏳ Watching for whale transfers (1000+ HIVE)...");

bot.observe.onWhaleAlert(threshold).subscribe({
  /*
   * This observer will trigger when any transfer exceeds the specified threshold amount.
   * The callback receives data of type {@link IWhaleAlertProviderData}, which includes:
   * - `data.whaleOperations` - Array of large transfer transaction-operation pairs exceeding the threshold
   * You can access each transaction/operation that contains details like from, to, amount, and memo.
   */
  next(data) {
    data.whaleOperations.forEach(({ operation }) => {
      console.log(`🐋 Whale alert: ${operation.from} -> ${operation.to} (${operation.amount})`);
    });
  },
  error: console.error
});
