/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onMention() — detect account mentions in posts/comments.
 *
 * The onMention observer monitors when specific accounts are mentioned:
 * - Detects @username mentions in post and comment content
 * - Tracks social interactions and notifications
 * - Essential for social engagement applications
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for mentions...");

bot.observe.onMention("gtg").subscribe({
  next(data) {
    data.mentioned.gtg?.forEach(comment => {
      console.log(`📣 Mention detected: @${comment.author} mentioned @gtg`);
    });
  },
  error: console.error
});
