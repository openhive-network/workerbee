/* eslint-disable no-console */
/**
 * Category: 🏦 Financial Operations
 * Demo: onExchangeTransfer() — monitor transfers to/from known exchanges.
 *
 * The onExchangeTransfer observer triggers when transfers involve known exchange
 * accounts. WorkerBee maintains a list of known exchanges automatically.
 *
 * Data Types & IDE IntelliSense:
 * - Monitors both deposits to and withdrawals from exchanges
 * - `data.exchangeTransferOperations`: Array of exchange transfer operations
 * - IDE shows all available exchange transfer properties via IntelliSense
 */
import WorkerBee from "../../../src";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for exchange transfers...");

bot.observe.onExchangeTransfer().subscribe({
  next(data) {
    data.exchangeTransferOperations.forEach(({ operation }) => {
      console.log(`🏦 Exchange transfer: ${operation.from} -> ${operation.to} (${operation.amount})`);
    });
  },
  error: console.error
});
