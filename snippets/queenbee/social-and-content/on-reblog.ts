/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onReblog() — watch reblog actions by accounts.
 *
 * This observer monitors when accounts reblog (share/repost) content. Captures
 * both the reblogger and original author information for content distribution
 * analysis. Multiple accounts can be monitored simultaneously.
 *
 * Filter Function Inputs:
 * - `...accounts: TAccountName[]` - Account names to monitor for reblog activity
 *
 * Callback Data:
 * The callback receives data of type {@link IReblogProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for reblogs...");

bot.observe.onReblog("guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when guest4test or guest4test1 reblogs content.
   * The callback receives data of type {@link IReblogProviderData}, which includes:
   * - `data.reblogs` - Contains reblog (comment_operation) transaction/operation pairs grouped by reblogger account
   * Remember to check if reblogs for specific account actually exist when observing multiple accounts.
   */
  next(data) {
    data.reblogs.guest4test?.forEach(({ operation }) => {
      console.log(`🔁 guest4test reblogged: @${operation.author}/${operation.permlink}`);
    });
  },
  error: console.error
});
