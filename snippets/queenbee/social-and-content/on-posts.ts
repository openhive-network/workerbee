/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onPosts() — monitor new posts by specific authors.
 *
 * This observer monitors new post creation on the Hive blockchain. Filters by
 * specific author account names and captures complete operations/transactions.
 * Multiple authors can be monitored at single observer call.
 *
 * Filter Function Inputs:
 * - `...authors: TAccountName[]` - Author account names to monitor for new posts
 *
 * Callback Data:
 * The callback receives data of type {@link IPostProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for new posts...");

bot.observe.onPosts("guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when guest4test or guest4test1 creates a new post.
   * The callback receives data of type {@link IPostProviderData}, which includes:
   * - `data.posts` - Contains post operations/transactions (hive comment_operation with empty parent_author property)
   * Remember to check if content for specific author actually exists when observing multiple authors.
   */
  next(data) {
    if (data.posts.guest4test)
      data.posts.guest4test.forEach(({ operation }) => {
        console.log(`📝 New post by guest4test: ${operation.author}/${operation.permlink}`);
      });

  },
  error: console.error
});
