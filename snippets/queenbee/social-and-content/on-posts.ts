/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onPosts() — monitor new posts by specific authors.
 *
 * The onPosts observer monitors new post creation on the Hive blockchain.
 * Filters by specific author account names and captures complete post data.
 *
 * Data Types & IDE IntelliSense:
 * - `operation.author` (string): The account that created the post
 * - `operation.permlink` (string): Unique identifier for the post
 * - `operation.title` and `operation.body`: Post content and title text
 * - `operation.json_metadata`: Additional metadata (tags, app info, etc.)
 * - IDE shows all available post properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for new posts...");

bot.observe.onPosts("gtg").subscribe({
  next(data) {
    data.posts.gtg?.forEach(({ operation }) => {
      console.log(`📝 New post detected: ${operation.author}/${operation.permlink}`);
    });
  },
  error: console.error
});
