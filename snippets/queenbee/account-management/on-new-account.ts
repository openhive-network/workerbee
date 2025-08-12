/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onNewAccount() — monitor newly created accounts.
 *
 * The onNewAccount observer triggers when new accounts are created on the
 * blockchain via account_create or account_create_with_delegation operations.
 *
 * Data Types & IDE IntelliSense:
 * - Monitors all new account creations without filtering
 * - `data.newAccounts`: Array of newly created account data
 * - IDE shows all available account creation properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for new accounts...");

bot.observe.onNewAccount().subscribe({
  next(data) {
    data.newAccounts.forEach(account => {
      console.log(`👶 New account created: - ${account.accountName} by ${account.creator}`);
    });
  },
  error: console.error
});
