import { test, expect } from "@playwright/test";
import { ChromiumBrowser, ConsoleMessage, chromium } from "playwright";

import "../assets/data";

let browser!: ChromiumBrowser;

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

  test("Should have global module", async({ page }) => {
    const moduleType = await page.evaluate(async() => {
      const bot = new AutoBee();
      let handlersCalled = 0;

      bot.addListener('start', () => { ++handlersCalled; });
      bot.addListener('stop', () => { ++handlersCalled; });

      await bot.start({ postingKey: '' });
      await bot.stop();

      return handlersCalled;
    });

    expect(moduleType).toStrictEqual(2);
  });

  test.afterAll(async() => {
    await browser.close();
  });
});
