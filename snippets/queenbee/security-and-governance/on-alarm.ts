/* eslint-disable no-console */
/**
 * Category: 🔐 Security & Governance
 * Demo: onAlarm() — monitor governance and security alarms.
 *
 * This observer triggers on various governance and security events like recovery
 * account changes, governance votes, witness actions, and other security-related
 * operations. Multiple accounts can be monitored simultaneously.
 *
 * Filter Function Inputs:
 * - `...accounts: TAccountName[]` - Account names to monitor for security and governance events
 *
 * Callback Data:
 * The callback receives data of type {@link IAlarmAccountsData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for governance alarms...");

bot.observe.onAlarm("guest4test", "guest4test1").subscribe({
  /*
   * This observer will trigger when security or governance events occur for guest4test or guest4test1.
   * The callback receives data of type {@link IAlarmAccountsData}, which includes:
   * - `data.alarmsPerAccount` - Contains alarm information grouped by account
   * Each account's alarms follow the {@link TAlarmAccounts} structure with {@link EAlarmType} categorization.
   */
  next(data) {
    data.alarmsPerAccount.guest4test?.forEach(alarm => {
      console.log(`🚨 Governance alarm for guest4test: ${alarm}`);
    });
    data.alarmsPerAccount.guest4test1?.forEach(alarm => {
      console.log(`🚨 Governance alarm for guest4test1: ${alarm}`);
    });
  },
  error: console.error
});
