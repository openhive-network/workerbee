/* eslint-disable no-console */
/**
 * Category: 👥 Social & Content
 * Demo: onCustomOperation() — monitor custom JSON operations by ID.
 *
 * This observer triggers when custom_json operations with specified IDs occur.
 * Used extensively by dApps and games like Splinterlands, PeakD, and other
 * applications building on Hive. Multiple operation IDs can be monitored simultaneously.
 *
 * Filter Function Inputs:
 * - `...ids: Array<string | number>` - Custom operation IDs to monitor (e.g., "follow", "reblog", "sm_claim_reward")
 *
 * Callback Data:
 * The callback receives data of type {@link ICustomOperationProviderData},
 * which is automatically deduced from the set of configured filters.
 */
import WorkerBee from "@hiveio/workerbee";

const bot = new WorkerBee();
await bot.start();

console.log("⏳ Watching for custom operations...");

bot.observe.onCustomOperation("follow", "reblog", "sm_claim_reward").subscribe({
  /*
   * This observer will trigger when custom operations with the specified IDs occur.
   * The callback receives data of type {@link ICustomOperationProviderData}, which includes:
   * - `data.customOperations` - Contains custom operations grouped by operation name
   * Each operation contains an array with transaction/operation pairs.
   */
  next(data) {
    if (data.customOperations.follow)
      data.customOperations.follow.forEach(({ operation }) => {
        console.log(`🔧 Follow operation detected: ${operation}`);
      });

    if (data.customOperations.reblog)
      console.log(`🔧 Reblog operations detected: ${data.customOperations.reblog.length}`);

    if (data.customOperations.sm_claim_reward)
      console.log(`🔧 Splinterlands reward claims detected: ${data.customOperations.sm_claim_reward.length}`);
  },
  error: console.error
});
