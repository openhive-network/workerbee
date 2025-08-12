/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onComments() — log new comments by authors.
 *
 * The onComments observer monitors new comment creation on the Hive blockchain:
 * - Filters by specific author account names
 * - Captures replies to posts and nested comment threads
 * - Real-time conversation and engagement tracking
 *
 * This snippet demonstrates:
 * - Author-specific comment monitoring using account filters
 * - Automatic provision of comment data by WorkerBee (content, parent info, etc.)
 * - Comment thread analysis and engagement metrics
 *
 * Data Types & IDE IntelliSense:
 * - `author` (string): The account that created the comment
 * - `permlink` (string): Unique identifier for the comment
 * - `body`: Comment content text
 * - `parent_author` and `parent_permlink`: The post or comment being replied to
 * - `json_metadata`: Additional metadata and app information
 * - IDE will show all available comment properties via IntelliSense
 *
 * Cross-reference: See on-posts.ts for original post monitoring
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for new comments...");

bot.observe.onComments("gtg").subscribe({
  next(data) {
    data.comments.gtg?.forEach(({ operation }) => {
      console.log(`💬 New comment detected: ${operation.author}/${operation.permlink}`);
    });
  },
  error: console.error
});
