/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onImpactedAccounts() — monitor all operations affecting accounts.
 *
 * This observer triggers when ANY operation affects the specified accounts
 * (transfers, votes received, mentions, follows, etc.). This provides comprehensive
 * account activity monitoring across all operation types.
 *
 * Filter Function Inputs:
 * - `...accounts: TAccountName[]` - Account names to monitor for any activity
 *
 * Callback Data:
 * The callback receives data of type {@link IImpactedAccountProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for account impacts...");

bot.observe.onImpactedAccounts("guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when guest4test or guest4test1 is affected by any blockchain operation.
   * The callback receives data of type {@link IImpactedAccountProviderData}, which includes:
   * - `data.impactedAccounts` - Contains operations that impacted each monitored account
   * Each account's data contains arrays of operation-transaction pairs affecting that account.
   * The callback receives data for all monitored accounts even if only one is impacted,
   * but the content for account that is not impacted will be undefined.
   */
  next(data) {
    data.impactedAccounts.guest4test?.forEach(({ operation }) => {
      console.log(`💥 Account guest4test impacted in operation: ${operation}`);
    });
  },
  error: console.error
});
