/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onPostsIncomingPayout() — monitor posts near payout window.
 *
 * This observer triggers when posts by specified authors are approaching their
 * payout window (7 days after creation). Useful for monitoring earnings and
 * content performance before final payout. Multiple authors can be monitored simultaneously.
 *
 * Filter Function Inputs:
 * - `relative: string` - Time window specification (e.g., "-1h" for last hour before payout)
 * - `...authors: TAccountName[]` - Author account names to monitor for upcoming payouts
 *
 * Callback Data:
 * The callback receives data of type {@link IPostMetadataProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for posts near payout...");

bot.observe.onPostsIncomingPayout("-1h", "guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when posts by guest4test or guest4test1 are 1 hour away from payout.
   * The callback receives data of type {@link IPostMetadataProviderData}, similar to the structure used in other post-related events.
   */
  next(data) {
    for(const account in data.postsMetadata)
      if(data.postsMetadata[account] !== undefined)
        for(const permlink in data.postsMetadata[account])
          console.log(`⏰ Post about to payout: @${account}/${permlink}`);
  },
  error: console.error
});
