import { test, expect } from "@playwright/test";
import { ChromiumBrowser, ConsoleMessage, chromium } from "playwright";

import "../assets/data";

let browser!: ChromiumBrowser;

const HIVE_BLOCK_INTERVAL = 3000;

test.describe("AutoBee Bot events test", () => {
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

  test("Should have a destroyable global module", async({ page }) => {
    await page.evaluate(async() => {
      const bot = new AutoBee({ postingKey: '5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT' });

      await bot.delete();
    });
  });

  test("Should call proper events", async({ page }) => {
    const handlersCalled = await page.evaluate(async() => {
      const bot = new AutoBee({ postingKey: '5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT' });
      bot.on("error", console.error);

      let handlersCalled = 0;

      bot.on('start', () => { ++handlersCalled; });
      bot.on('stop', () => { ++handlersCalled; });

      await bot.start();
      await bot.stop();

      return handlersCalled;
    });

    expect(handlersCalled).toStrictEqual(2);
  });

  test("Should be able to parse at least 2 blocks from the remote", async({ page }) => {
    const blocksParsed = await page.evaluate(async(HIVE_BLOCK_INTERVAL) => {
      const bot = new AutoBee({ postingKey: '5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT' });
      bot.on("error", console.error);

      let blocksParsed = 0;
      bot.on("block", ({ block, number }) => {
        console.info(`Got block #${block.block_id} (${number})`);
        ++blocksParsed;
      });

      await bot.start();

      await Promise.race([
        new Promise((res) => { setTimeout(res, HIVE_BLOCK_INTERVAL * 4); }),
        new Promise<void>((res) => {
          bot.on("stop", res);
        })
      ]);

      await bot.stop();
      await bot.delete();

      return blocksParsed;
    }, HIVE_BLOCK_INTERVAL);

    expect(blocksParsed).toBeGreaterThanOrEqual(1);
  });

  test.afterAll(async() => {
    await browser.close();
  });
});
