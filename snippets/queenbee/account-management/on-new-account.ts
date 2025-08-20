/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onNewAccount() — monitor newly created accounts.
 *
 * This observer triggers when new accounts are created on the blockchain via
 * account_create or account_create_with_delegation operations. No input parameters
 * required as it monitors all new account creations.
 *
 * Filter Function Inputs:
 * - No parameters required (monitors all new account creations)
 *
 * Callback Data:
 * The callback receives data of type {@link INewAccountProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for new accounts...");

bot.observe.onNewAccount().subscribe({
  /*
   * This observer will trigger when any new account is created on the blockchain.
   * The callback receives data of type {@link INewAccountProviderData}, which includes:
   * - `data.newAccounts` - Array of newly created account data with account details
   * Each new account object contains information like accountName, creator, and creation details.
   */
  next(data) {
    data.newAccounts.forEach(account => {
      console.log(`👶 New account created: - ${account.accountName} by ${account.creator}`);
    });
  },
  error: console.error
});
