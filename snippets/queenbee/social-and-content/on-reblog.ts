/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onReblog() — watch reblog actions by accounts.
 *
 * The onReblog observer monitors when accounts reblog (share/repost) content:
 * - Detects when specified accounts reblog posts
 * - Captures both the reblogger and original author information
 * - Real-time reblog activity tracking for content distribution analysis
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for reblogs...");

bot.observe.onReblog("gtg").subscribe({
  next(data) {
    data.reblogs.gtg?.forEach(({ operation }) => {
      console.log(`🔁 Reblog detected: @${operation.account} reblogged @${operation.author}/${operation.permlink}`);
    });
  },
  error: console.error
});
