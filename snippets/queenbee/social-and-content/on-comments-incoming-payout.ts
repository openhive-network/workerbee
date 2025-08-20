/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onCommentsIncomingPayout() — monitor comments near payout window.
 *
 * This observer triggers when comments by specified authors are approaching their
 * payout window (7 days after creation). Useful for monitoring comment earnings
 * and engagement performance before final payout. Multiple authors can be monitored simultaneously.
 *
 * Filter Function Inputs:
 * - `relative: string` - Time window specification (e.g., "-30m" for last 30 minutes before payout)
 * - `...authors: TAccountName[]` - Author account names to monitor for upcoming comment payouts
 *
 * Callback Data:
 * The callback receives data of type {@link ICommentMetadataProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for comments near payout...");

bot.observe.onCommentsIncomingPayout("-30m", "guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when comments by guest4test or guest4test1 are 30 minutes away from payout.
   * The callback receives data of type {@link ICommentMetadataProviderData}, similar to the structure used in other comment-related events.
   */
  next(data) {
    for(const account in data.commentsMetadata)
      if(data.commentsMetadata[account] !== undefined)
        for(const permlink in data.commentsMetadata[account])
          console.log(`⏰ Comment about to payout: @${account}/${permlink}`);
  },
  error: console.error
});
