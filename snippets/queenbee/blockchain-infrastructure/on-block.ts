/* eslint-disable no-console */
/**
 * Category: ⚙️ Blockchain Infrastructure
 * Demo: onBlock() — logs new block headers for a short duration.
 *
 * This is the foundational snippet that demonstrates WorkerBee's core concepts.
 * The onBlock observer triggers on every new block and provides block header data.
 *
 * Data Types & IDE IntelliSense:
 * - `data.block.number` (number): Block height
 * - `data.block.id` (string): Block hash identifier
 * - `data.block.timestamp` (Date): When the block was produced
 * - IDE shows all available block properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Listening for new blocks...");

bot.observe.onBlock().subscribe({
  next({ block }) {
    console.log(`📦 Block #${block.number} id=${block.id} time=${block.timestamp}`);
  },
  error: console.error
});
