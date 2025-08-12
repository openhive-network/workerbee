/* eslint-disable no-console */
/**
 * Category: ⚙️ Blockchain Infrastructure
 * Demo: onBlockNumber() — wait for a specific upcoming block number.
 *
 * The onBlockNumber observer triggers when a specific block number is reached.
 * Useful for scheduled operations, testing, or waiting for governance proposals.
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

// Wait for a future block (adjust this number as needed)
const targetBlock = 99999999;

console.log(`⏳ Waiting for block #${targetBlock}...`);

bot.observe.onBlockNumber(targetBlock).subscribe({
  next() {
    console.log("🎯 Target block reached!");
  },
  error: console.error
});
