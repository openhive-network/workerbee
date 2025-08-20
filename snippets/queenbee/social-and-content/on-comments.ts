/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onComments() — log new comments by authors.
 *
 * This observer monitors new comment creation on the Hive blockchain. Filters by
 * specific author account names and captures replies to posts and nested comment
 * threads. Multiple authors can be monitored at single observer call.
 *
 * Filter Function Inputs:
 * - `...authors: TAccountName[]` - Author account names to monitor for new comments
 *
 * Callback Data:
 * The callback receives data of type {@link ICommentProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for new comments...");

bot.observe.onComments("guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when guest4test or guest4test1 creates a new comment.
   * See on-posts.ts for more details on how observing comment_operation works.
   * In this case, the callback will occur for comment_operation with not empty parent_author property.
   */
  next(data) {
    if (data.comments.guest4test)
      data.comments.guest4test?.forEach(({ operation }) => {
        console.log(`💬 New comment by guest4test: ${operation.author}/${operation.permlink}`);
      });
  },
  error: console.error
});
