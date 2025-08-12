/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onVotes() — monitor voting activity by specific accounts.
 *
 * The onVotes observer monitors voting activity on the Hive blockchain.
 * Tracks upvotes and downvotes by specific accounts with voting details.
 *
 * Data Types & IDE IntelliSense:
 * - `operation.voter` (string): The account that cast the vote
 * - `operation.author` and `operation.permlink`: The post/comment being voted on
 * - `operation.weight` (number): Vote strength (-10000 to +10000)
 * - Positive weight = upvote, negative weight = downvote
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for votes...");

bot.observe.onVotes("gtg").subscribe({
  next(data) {
    data.votes.gtg?.forEach(({ operation }) => {
      console.log(`👍 @${operation.voter} voted: ${operation.author}/${operation.permlink} (weight: ${operation.weight})`);
    });
  },
  error: console.error
});
