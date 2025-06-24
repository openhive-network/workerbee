/* eslint-disable no-console */
import { ChromiumBrowser, ConsoleMessage, chromium } from "playwright";
import { expect } from "playwright/test";
import { IBlockData, IBlockHeaderData, IFeedPriceData } from "../../dist/bundle";
import { test } from "../assets/jest-helper";

let browser!: ChromiumBrowser;

test.describe("Bot Providers", () => {
  test.beforeAll(async() => {
    browser = await chromium.launch({
      headless: true
    });
  });

  test.beforeEach(async({ page }) => {
    page.on("console", (msg: ConsoleMessage) => {
      console.log(">>", msg.type(), msg.text());
    });

    await page.goto("http://localhost:8080/__tests__/assets/test.html", { waitUntil: "load" });
  });

  test("Should be able to provide witnesses", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let witnesses = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideWitnesses("gtg");

        observer.subscribe({
          next: (data) => {
            witnesses = data.witnesses;

            if (witnesses !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return witnesses;
    });

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"].owner).toBe("gtg");
    expect(result["gtg"].totalMissedBlocks).not.toBeNaN();
    expect(result["gtg"].lastConfirmedBlockNum).not.toBeNaN();
  });

  test("Should be able to provide RC accounts", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let rcAccounts = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideRcAccounts("gtg");

        observer.subscribe({
          next: (data) => {
            rcAccounts = data.rcAccounts;

            if (rcAccounts !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return rcAccounts;
    });

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"].name).toBe("gtg");
    expect(result["gtg"]).toHaveProperty("rcManabar");
  });

  test("Should be able to provide feed price data", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let feedPrice!: IFeedPriceData;

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideFeedPriceData();

        observer.subscribe({
          next: (data) => {
            feedPrice = data.feedPrice;

            if (feedPrice !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return feedPrice;
    });

    expect(result).toHaveProperty("currentMedianHistory");
    expect(result).toHaveProperty("currentMinHistory");
    expect(result).toHaveProperty("currentMaxHistory");
    expect(result).toHaveProperty("priceHistory");
  });

  test("Should be able to provide block header data", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let block!: IBlockHeaderData;

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideBlockHeaderData();

        observer.subscribe({
          next: (data) => {
            block = data.block;

            if (block !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return block;
    });

    expect(result.number).not.toBeNaN();
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("witness");
  });

  test("Should be able to provide block data", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let block!: IBlockData & IBlockHeaderData;

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideBlockData();

        observer.subscribe({
          next: (data) => {
            block = data.block;

            if (block !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return block;
    });

    expect(result.number).not.toBeNaN();
    expect(result).toHaveProperty("transactions");
    expect(result).toHaveProperty("transactionsPerId");
  });

  test("Should be able to provide accounts", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let accounts = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideAccounts("gtg");

        observer.subscribe({
          next: (data) => {
            accounts = data.accounts;

            if (accounts !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return accounts;
    });

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"].name).toBe("gtg");
  });

  test("Should be able to provide manabar data", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let manabarData = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock().provideManabarData(2, "gtg"); // Upvote manabar

        observer.subscribe({
          next: (data) => {
            manabarData = data.manabarData;

            if (manabarData !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return manabarData;
    });

    expect(result["gtg"]).toBeDefined();
    expect(result["gtg"][2].percent).toBeGreaterThanOrEqual(0);
  });

  test("Should be able to combine witnesses and accounts providers", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let witnesses = {};
      let accounts = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock()
          .provideWitnesses("gtg")
          .provideAccounts("gtg");

        observer.subscribe({
          next: (data) => {
            witnesses = data.witnesses;
            accounts = data.accounts;

            if (witnesses !== undefined && accounts !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return { witnesses, accounts };
    });

    expect(result.witnesses["gtg"]).toBeDefined();
    expect(result.witnesses["gtg"].owner).toBe("gtg");
    expect(result.accounts["gtg"]).toBeDefined();
    expect(result.accounts["gtg"].name).toBe("gtg");
  });

  test("Should be able to combine feed price data and block header providers", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let feedPrice!: IFeedPriceData;
      let block!: IBlockHeaderData;

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock()
          .provideFeedPriceData()
          .provideBlockHeaderData();

        observer.subscribe({
          next: (data) => {
            feedPrice = data.feedPrice;
            block = data.block;

            if (feedPrice !== undefined && block !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return { feedPrice, block };
    });

    expect(result.feedPrice).toHaveProperty("currentMedianHistory");
    expect(result.feedPrice).toHaveProperty("priceHistory");
    expect(result.block.number).not.toBeNaN();
    expect(result.block).toHaveProperty("timestamp");
    expect(result.block).toHaveProperty("witness");
  });

  test("Should be able to combine multiple account-related providers", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let accounts = {};
      let rcAccounts = {};
      let manabarData = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock()
          .provideAccounts("gtg")
          .provideRcAccounts("gtg")
          .provideManabarData(2, "gtg"); // Upvote manabar

        observer.subscribe({
          next: (data) => {
            accounts = data.accounts;
            rcAccounts = data.rcAccounts;
            manabarData = data.manabarData;

            if (accounts !== undefined && rcAccounts !== undefined && manabarData !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return { accounts, rcAccounts, manabarData };
    });

    expect(result.accounts["gtg"]).toBeDefined();
    expect(result.accounts["gtg"].name).toBe("gtg");
    expect(result.rcAccounts["gtg"]).toBeDefined();
    expect(result.rcAccounts["gtg"].name).toBe("gtg");
    expect(result.rcAccounts["gtg"]).toHaveProperty("rcManabar");
    expect(result.manabarData["gtg"]).toBeDefined();
    expect(result.manabarData["gtg"][2].percent).toBeGreaterThanOrEqual(0);
  });

  test("Should be able to combine block data with feed price data", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let block!: IBlockData & IBlockHeaderData;
      let feedPrice!: IFeedPriceData;

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock()
          .provideBlockData()
          .provideFeedPriceData();

        observer.subscribe({
          next: (data) => {
            block = data.block;
            feedPrice = data.feedPrice;

            if (block !== undefined && feedPrice !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return { block, feedPrice };
    });

    expect(result.block.number).not.toBeNaN();
    expect(result.block).toHaveProperty("transactions");
    expect(result.block).toHaveProperty("transactionsPerId");
    expect(result.feedPrice).toHaveProperty("currentMedianHistory");
    expect(result.feedPrice).toHaveProperty("priceHistory");
  });

  test("Should be able to combine all available providers", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let witnesses = {};
      let accounts = {};
      let rcAccounts = {};
      let manabarData = {};
      let block!: IBlockData & IBlockHeaderData;
      let feedPrice!: IFeedPriceData;

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock()
          .provideWitnesses("gtg")
          .provideAccounts("gtg")
          .provideRcAccounts("gtg")
          .provideManabarData(2, "gtg") // Upvote manabar
          .provideBlockData()
          .provideFeedPriceData();

        observer.subscribe({
          next: (data) => {
            witnesses = data.witnesses;
            accounts = data.accounts;
            rcAccounts = data.rcAccounts;
            manabarData = data.manabarData;
            block = data.block;
            feedPrice = data.feedPrice;

            if (witnesses !== undefined && accounts !== undefined &&
                rcAccounts !== undefined && manabarData !== undefined &&
                block !== undefined && feedPrice !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return { witnesses, accounts, rcAccounts, manabarData, block, feedPrice };
    });

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

  test("Should be able to combine multiple accounts for different providers", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let witnesses = {};
      let accounts = {};
      let rcAccounts = {};

      await new Promise<void>(resolve => {
        const observer = bot.observe.onBlock()
          .provideWitnesses("gtg", "steemit")
          .provideAccounts("gtg", "steemit", "blocktrades")
          .provideRcAccounts("gtg", "blocktrades");

        observer.subscribe({
          next: (data) => {
            witnesses = data.witnesses;
            accounts = data.accounts;
            rcAccounts = data.rcAccounts;

            if (witnesses !== undefined && accounts !== undefined && rcAccounts !== undefined)
              resolve();
          },
          error: (err) => {
            console.error(err);
          },
          complete: () => resolve()
        });
      });

      bot.stop();
      bot.delete();

      return { witnesses, accounts, rcAccounts };
    });

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

  test.afterAll(async() => {
    await browser.close();
  });
});
