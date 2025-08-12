/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onCommentsIncomingPayout() — monitor comments near payout window.
 *
 * The onCommentsIncomingPayout observer triggers when comments by specified
 * authors are approaching their payout window (7 days after creation).
 *
 * Data Types & IDE IntelliSense:
 * - `relative` (string): Time window like "-30m" for last 30 minutes
 * - `data.commentsMetadata`: Comment payout information by author
 * - IDE shows all available payout properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for comments near payout...");

bot.observe.onCommentsIncomingPayout("-30m", "gtg").subscribe({
  next(data) {
    for(const account in data.commentsMetadata)
      if(data.commentsMetadata[account] !== undefined)
        for(const permlink of data.commentsMetadata[account])
          console.log("Comment about to payout:", data.commentsMetadata[account][permlink]);

  },
  error: console.error
});
