/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onAccountsFullManabar() — notify when accounts reach 98% manabar.
 *
 * The onAccountsFullManabar observer monitors manabar levels and triggers
 * when any specified account reaches 98% (full) manabar capacity.
 *
 * Data Types & IDE IntelliSense:
 * - `EManabarType.RC`: Resource Credits for transactions
 * - `EManabarType.VOTING`: Voting power
 * - `EManabarType.DOWNVOTING`: Downvoting power
 * - `data.account`: Account name that reached full manabar
 * - `data.percentage`: Current manabar percentage
 */
import { EManabarType } from "@hiveio/wax";
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for accounts with full RC manabar...");

bot.observe.onAccountsFullManabar(EManabarType.RC, "gtg").subscribe({
  next(data) {
    console.log(`⚡ Account gtg has ${data.manabarData.gtg?.[EManabarType.RC]?.percent}% RC manabar!`);
  },
  error: console.error
});
