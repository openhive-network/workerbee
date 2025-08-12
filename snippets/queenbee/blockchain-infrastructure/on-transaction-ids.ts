/* eslint-disable no-console */
/**
 * Category: ⚙️ Blockchain Infrastructure
 * Demo: onTransactionIds() — monitor specific transaction IDs.
 *
 * The onTransactionIds observer triggers when specific transaction IDs
 * appear on the blockchain. Useful for tracking specific transactions.
 *
 * Data Types & IDE IntelliSense:
 * - `transactionIds` (string[]): Transaction IDs to monitor
 * - `data.transactions`: Transaction data when IDs are found
 * - IDE shows all available transaction properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for specific transaction IDs...");

// Example transaction ID (replace with actual ones)
bot.observe.onTransactionIds("example-tx-id-1").subscribe({
  next(data) {
    console.log(`🔍 Transaction found: ${data.transactions["example-tx-id-1"]}`);
  },
  error: console.error
});
