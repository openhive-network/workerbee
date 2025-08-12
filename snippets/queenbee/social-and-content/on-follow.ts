/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onFollow() — watch follow/mute/blacklist events emitted by accounts.
 *
 * The onFollow observer monitors social graph changes on the Hive blockchain:
 * - Follow actions (adding someone to your following list)
 * - Mute actions (blocking content from specific accounts)
 * - Blacklist actions (more severe blocking)
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for follow events...");

bot.observe.onFollow("gtg").subscribe({
  next(data) {
    data.follows.gtg?.forEach(({ operation }) => {
      console.log(`🧭 Follow event: @${operation.follower} followed @${operation.following}`);
    });
  },
  error: console.error
});
