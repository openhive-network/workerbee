import { test, expect } from "@playwright/test";
import { ChromiumBrowser, ConsoleMessage, chromium } from "playwright";

import "../assets/data";

let browser!: ChromiumBrowser;

test.describe("AutoBee Base tests", () => {
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

  // Base browser type test
  test("Should test on chromium", async() => {
    const browserType = browser.browserType();

    expect(browserType.name()).toBe("chromium");
  });

  // Base valid test html webpage test
  test("Should have a valid html test webpage", async({ page }) => {
    const id = await page.$eval("body", n => n.getAttribute("id"));

    expect(id).toBe("autobeebody");
  });

  test("Should have global module", async({ page }) => {
    const moduleType = await page.evaluate(() => {
      return typeof bootstrap;
    });

    expect(moduleType).toBe("function");
  });

  test.afterAll(async() => {
    await browser.close();
  });
});
