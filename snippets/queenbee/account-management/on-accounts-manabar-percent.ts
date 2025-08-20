/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onAccountsManabarPercent() — watch for manabar threshold percentage.
 *
 * This observer triggers when accounts reach a specific manabar percentage threshold.
 * You can specify a manabar kind to be monitored (expressed by values of {@link EManabarType}).
 * Multiple account names can be observed at single observer call.
 *
 * Filter Function Inputs:
 * - `manabarType: EManabarType` - The type of manabar to monitor (RC, UPVOTE, or DOWNVOTE)
 * - `percent: number` - The percentage threshold to trigger on (0-100)
 * - `...accounts: TAccountName[]` - Account names to monitor for threshold
 *
 * Callback Data:
 * The callback receives data of type {@link IManabarProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import { EManabarType } from "@hiveio/wax";
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for accounts with 90%+ RC manabar...");

bot.observe.onAccountsManabarPercent(EManabarType.RC, 90, "guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when either guest4test or guest4test1 reaches 90% RC manabar.
   * The callback receives data of type {@link IManabarProviderData}, which includes:
   * - `data.manabarData` - Contains manabar information for each monitored account
   * The callback receives data for all monitored accounts even if only one reaches the threshold.
   * The rest of the accounts will point to undefined so you should check for their existence before accessing their properties.
   */
  next(data) {
    if (data.manabarData.guest4test)
      console.log(`🔋 Account guest4test has ${data.manabarData.guest4test?.[EManabarType.RC]?.percent}% RC manabar!`);
  },
  error: console.error
});
