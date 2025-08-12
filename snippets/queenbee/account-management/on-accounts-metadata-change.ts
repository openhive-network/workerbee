/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onAccountsMetadataChange() — watch accounts for metadata updates.
 *
 * The onAccountsMetadataChange observer triggers when accounts update their
 * profile data, posting keys, recovery accounts, or other metadata.
 *
 * Data Types & IDE IntelliSense:
 * - Monitors account_update operations
 * - `data`: Account update operation data
 * - IDE shows all available account update properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for account metadata changes...");

bot.observe.onAccountsMetadataChange("gtg").subscribe({
  next() {
    console.log("👤 Account metadata changed");
  },
  error: console.error
});
