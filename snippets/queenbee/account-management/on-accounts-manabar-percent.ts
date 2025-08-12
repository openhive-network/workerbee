/* eslint-disable no-console */
/**
 * Category: 👤 Account Management
 * Demo: onAccountsManabarPercent() — watch for manabar threshold percentage.
 *
 * The onAccountsManabarPercent observer triggers when accounts reach a specific
 * manabar percentage threshold. Simple monitoring without complex logic.
 *
 * Data Types & IDE IntelliSense:
 * - `EManabarType.RC`: Resource Credits for transactions
 * - `EManabarType.VOTING`: Voting power
 * - `data.manabarData`: Account manabar information
 * - IDE shows all available manabar properties via IntelliSense
 */
import { EManabarType } from "@hiveio/wax";
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for accounts with 90%+ RC manabar...");

bot.observe.onAccountsManabarPercent(EManabarType.RC, 90, "gtg").subscribe({
  next(data) {
    console.log(`🔋 Manabar threshold reached: ${data.manabarData.gtg?.[EManabarType.RC]?.percent}`);
  },
  error: console.error
});
