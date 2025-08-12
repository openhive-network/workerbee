/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onAccountsBalanceChange() — monitor account balance updates.
 *
 * The onAccountsBalanceChange observer triggers when account balances change
 * due to transfers, rewards, or other financial operations.
 *
 * Data Types & IDE IntelliSense:
 * - `includeInternal` (boolean): Whether to include internal balance changes
 * - `data`: Balance change data for the affected accounts
 * - IDE shows all available balance change properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for balance changes...");

bot.observe.onAccountsBalanceChange(true, "gtg").subscribe({
  next() {
    console.log("💰 Balance changed");
  },
  error: console.error
});
