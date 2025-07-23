/* eslint-disable no-console */
import { expect } from "playwright/test";
import { test } from "../assets/jest-helper";

test.describe("Bot Providers", () => {
  test("Should be able to provide witnesses", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideWitnesses("gtg");

      observer.subscribe({
        next: (data) => {
          if (data.witnesses !== undefined)
            resolve(data.witnesses);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"].owner).toBe("gtg");
    expect(result["gtg"].totalMissedBlocks).not.toBeNaN();
    expect(result["gtg"].lastConfirmedBlockNum).not.toBeNaN();
  });

  test("Should be able to provide RC accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideRcAccounts("gtg");

      observer.subscribe({
        next: (data) => {
          if (data.rcAccounts !== undefined)
            resolve(data.rcAccounts);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"].name).toBe("gtg");
    expect(result["gtg"]).toHaveProperty("rcManabar");
  });

  test("Should be able to provide feed price data", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideFeedPriceData();

      observer.subscribe({
        next: (data) => {
          if (data.feedPrice !== undefined)
            resolve(data.feedPrice);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result).toHaveProperty("currentMedianHistory");
    expect(result).toHaveProperty("currentMinHistory");
    expect(result).toHaveProperty("currentMaxHistory");
    expect(result).toHaveProperty("priceHistory");
  });

  test("Should be able to provide block header data", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideBlockHeaderData();

      observer.subscribe({
        next: (data) => {
          if (data.block !== undefined)
            resolve(data.block);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result.number).not.toBeNaN();
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("witness");
  });

  test("Should be able to provide block data", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideBlockData();

      observer.subscribe({
        next: (data) => {
          if (data.block !== undefined)
            resolve(data.block);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result.number).not.toBeNaN();
    expect(result).toHaveProperty("transactions");
    expect(result).toHaveProperty("transactionsPerId");
  });

  test("Should be able to provide accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideAccounts("gtg");

      observer.subscribe({
        next: (data) => {
          if (data.accounts !== undefined)
            resolve(data.accounts);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"].name).toBe("gtg");
  });

  test("Should be able to provide manabar data", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock().provideManabarData(2, "gtg"); // Upvote manabar

      observer.subscribe({
        next: (data) => {
          if (data.manabarData !== undefined)
            resolve(data.manabarData);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"][2].percent).toBeGreaterThanOrEqual(0);
  });

  test("Should be able to combine witnesses and accounts providers", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock()
        .provideWitnesses("gtg")
        .provideAccounts("gtg");

      observer.subscribe({
        next: (data) => {
          if (data.witnesses !== undefined && data.accounts !== undefined)
            resolve({ witnesses: data.witnesses, accounts: data.accounts });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result.witnesses["gtg"]).toBeDefined();
    expect(result.witnesses["gtg"].owner).toBe("gtg");
    expect(result.accounts["gtg"]).toBeDefined();
    expect(result.accounts["gtg"].name).toBe("gtg");
  });

  test("Should be able to combine feed price data and block header providers", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock()
        .provideFeedPriceData()
        .provideBlockHeaderData();

      observer.subscribe({
        next: (data) => {
          if (data.feedPrice !== undefined && data.block !== undefined)
            resolve({ feedPrice: data.feedPrice, block: data.block });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result.feedPrice).toHaveProperty("currentMedianHistory");
    expect(result.feedPrice).toHaveProperty("priceHistory");
    expect(result.block.number).not.toBeNaN();
    expect(result.block).toHaveProperty("timestamp");
    expect(result.block).toHaveProperty("witness");
  });

  test("Should be able to combine multiple account-related providers", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock()
        .provideAccounts("gtg")
        .provideRcAccounts("gtg")
        .provideManabarData(2, "gtg"); // Upvote manabar

      observer.subscribe({
        next: (data) => {
          if (data.accounts !== undefined && data.rcAccounts !== undefined && data.manabarData !== undefined)
            resolve({ accounts: data.accounts, rcAccounts: data.rcAccounts, manabarData: data.manabarData });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result.accounts["gtg"]).toBeDefined();
    expect(result.accounts["gtg"].name).toBe("gtg");
    expect(result.rcAccounts["gtg"]).toBeDefined();
    expect(result.rcAccounts["gtg"].name).toBe("gtg");
    expect(result.rcAccounts["gtg"]).toHaveProperty("rcManabar");
    expect(result.manabarData["gtg"]).toBeDefined();
    expect(result.manabarData["gtg"][2].percent).toBeGreaterThanOrEqual(0);
  });

  test("Should be able to combine block data with feed price data", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock()
        .provideBlockData()
        .provideFeedPriceData();

      observer.subscribe({
        next: (data) => {
          if (data.block !== undefined && data.feedPrice !== undefined)
            resolve({ block: data.block, feedPrice: data.feedPrice });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    expect(result.block.number).not.toBeNaN();
    expect(result.block).toHaveProperty("transactions");
    expect(result.block).toHaveProperty("transactionsPerId");
    expect(result.feedPrice).toHaveProperty("currentMedianHistory");
    expect(result.feedPrice).toHaveProperty("priceHistory");
  });

  test("Should be able to combine all available providers", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock()
        .provideWitnesses("gtg")
        .provideAccounts("gtg")
        .provideRcAccounts("gtg")
        .provideManabarData(2, "gtg") // Upvote manabar
        .provideBlockData()
        .provideFeedPriceData();

      observer.subscribe({
        next: (data) => {
          if (
            data.witnesses !== undefined && data.accounts !== undefined &&
            data.rcAccounts !== undefined && data.manabarData !== undefined &&
            data.block !== undefined && data.feedPrice !== undefined
          )
            resolve({
              witnesses: data.witnesses,
              accounts: data.accounts,
              rcAccounts: data.rcAccounts,
              manabarData: data.manabarData,
              block: data.block,
              feedPrice: data.feedPrice
            });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    // Test witnesses provider
    expect(result.witnesses["gtg"]).toBeDefined();
    expect(result.witnesses["gtg"].owner).toBe("gtg");

    // Test accounts provider
    expect(result.accounts["gtg"]).toBeDefined();
    expect(result.accounts["gtg"].name).toBe("gtg");

    // Test RC accounts provider
    expect(result.rcAccounts["gtg"]).toBeDefined();
    expect(result.rcAccounts["gtg"].name).toBe("gtg");
    expect(result.rcAccounts["gtg"]).toHaveProperty("rcManabar");

    // Test manabar data provider
    expect(result.manabarData["gtg"]).toBeDefined();
    expect(result.manabarData["gtg"][2].percent).toBeGreaterThanOrEqual(0);

    // Test block data provider
    expect(result.block.number).not.toBeNaN();
    expect(result.block).toHaveProperty("transactions");
    expect(result.block).toHaveProperty("transactionsPerId");

    // Test feed price data provider
    expect(result.feedPrice).toHaveProperty("currentMedianHistory");
    expect(result.feedPrice).toHaveProperty("priceHistory");
  });

  test("Should be able to combine multiple accounts for different providers", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const observer = bot.onBlock()
        .provideWitnesses("gtg", "steemit")
        .provideAccounts("gtg", "steemit", "blocktrades")
        .provideRcAccounts("gtg", "blocktrades");

      observer.subscribe({
        next: (data) => {
          if (data.witnesses !== undefined && data.accounts !== undefined && data.rcAccounts !== undefined)
            resolve({ witnesses: data.witnesses, accounts: data.accounts, rcAccounts: data.rcAccounts });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve()
      });
    }, undefined, undefined, true);

    // Test witnesses for multiple accounts
    expect(result.witnesses["gtg"]).toBeDefined();
    expect(result.witnesses["steemit"]).toBeDefined();
    expect(result.witnesses["gtg"].owner).toBe("gtg");
    expect(result.witnesses["steemit"].owner).toBe("steemit");

    // Test accounts for multiple accounts
    expect(result.accounts["gtg"]).toBeDefined();
    expect(result.accounts["steemit"]).toBeDefined();
    expect(result.accounts["blocktrades"]).toBeDefined();
    expect(result.accounts["gtg"].name).toBe("gtg");
    expect(result.accounts["steemit"].name).toBe("steemit");
    expect(result.accounts["blocktrades"].name).toBe("blocktrades");

    // Test RC accounts for selected accounts
    expect(result.rcAccounts["gtg"]).toBeDefined();
    expect(result.rcAccounts["blocktrades"]).toBeDefined();
    expect(result.rcAccounts["gtg"].name).toBe("gtg");
    expect(result.rcAccounts["blocktrades"].name).toBe("blocktrades");
  });
});
