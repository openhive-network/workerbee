/* eslint-disable no-console */
/**
 * Category: ⚙️ Blockchain Infrastructure
 * Demo: onBlockNumber() — wait for a specific upcoming block number.
 *
 * This observer triggers when a specific block number is reached.
 * Useful for scheduled operations, testing, or waiting for governance proposals.
 *
 * Filter Function Inputs:
 * - `blockNumber: number` - The specific block number to wait for
 *
 * There is no callback data for this observer.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

// Wait for a future block (adjust this number as needed)
const targetBlock = 99999999;

console.log(`⏳ Waiting for block #${targetBlock}...`);

bot.observe.onBlockNumber(targetBlock).subscribe({
  /*
   * This observer will trigger when the blockchain reaches the specified block number.
   * Useful for scheduled operations, testing, or waiting for governance proposals.
   * There is no callback data for this observer - it simply notifies when the target block is reached.
   * The main concept of this observer is to observe for specific block without a need of calling get_block API
   * This is why the block header data is also not available in the callback.
   */
  next() {
    console.log("🎯 Target block reached!");
  },
  error: console.error
});
