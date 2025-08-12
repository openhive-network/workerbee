/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onPostsIncomingPayout() — monitor posts near payout window.
 *
 * The onPostsIncomingPayout observer triggers when posts by specified
 * authors are approaching their payout window (7 days after creation).
 *
 * Data Types & IDE IntelliSense:
 * - `relative` (string): Time window like "-1h" for last hour
 * - `data.postsMetadata`: Post payout information by author
 * - IDE shows all available payout properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for posts near payout...");

bot.observe.onPostsIncomingPayout("-1h", "gtg").subscribe({
  next(data) {
    for(const account in data.postsMetadata)
      if(data.postsMetadata[account] !== undefined)
        for(const permlink of data.postsMetadata[account])
          console.log("Post about to payout:", data.postsMetadata[account][permlink]);
  },
  error: console.error
});
