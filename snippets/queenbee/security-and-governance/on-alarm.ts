/* eslint-disable no-console */
/**
 * Category: 🔐 Security & Governance
 * Demo: onAlarm() — monitor governance and security alarms.
 *
 * The onAlarm observer triggers on various governance and security events
 * like recovery account changes, governance votes, and witness actions.
 *
 * Data Types & IDE IntelliSense:
 * - Monitors governance and security events for specified accounts
 * - `data.alarmsPerAccount`: Account-specific alarm information
 * - IDE shows all available alarm properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for governance alarms...");

bot.observe.onAlarm("gtg").subscribe({
  next(data) {
    data.alarmsPerAccount.gtg?.forEach(alarm => {
      console.log(`🚨 Governance alarm: ${alarm}`);
    })
  },
  error: console.error
});
