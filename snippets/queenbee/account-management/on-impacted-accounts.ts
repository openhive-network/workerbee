/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onImpactedAccounts() — monitor all operations affecting accounts.
 *
 * The onImpactedAccounts observer triggers when ANY operation affects the
 * specified accounts (transfers, votes received, mentions, follows, etc.).
 *
 * Data Types & IDE IntelliSense:
 * - Comprehensive account activity monitoring
 * - `data`: Impact data showing which operations affected the accounts
 * - IDE shows all available impact properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for account impacts...");

bot.observe.onImpactedAccounts("gtg").subscribe({
  next(data) {
    data.impactedAccounts.gtg?.forEach(({ operation }) => {
      console.log(`💥 Account impacted in operation: ${operation}`);
    });
  },
  error: console.error
});
