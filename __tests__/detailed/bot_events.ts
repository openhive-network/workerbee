/* eslint-disable no-console */
import type { ApiAccount } from "@hiveio/wax";
import { expect } from "@playwright/test";
import { ChromiumBrowser, ConsoleMessage, chromium } from "playwright";

import type { IStartConfiguration } from "../../src/bot";
import type { IBlockData } from "../../src/interfaces";
import { test } from "../assets/jest-helper";


let browser!: ChromiumBrowser;

const HIVE_BLOCK_INTERVAL = 3000;

test.describe("WorkerBee Bot events test", () => {
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

  test("Allow to pass explicit chain", async({ workerbeeTest }) => {
    const explicitChainTest = await workerbeeTest(async({ WorkerBee }) => {

      /*
       * Prepare helper WorkerBee instance just to provide IHiveChainInterface instance.
       * It is a problem in PW tests to reference whole wax, since its dependencies need to be declared at importmap in test.html
       */
      const customWaxConfig = { apiEndpoint: "https://api.openhive.network", chainId: "badf00d" };
      const customConfig: IStartConfiguration = { chainOptions: customWaxConfig };

      const chainOwner = new WorkerBee(customConfig);
      // Call start just to initialize chain member in WorkerBee object.
      await chainOwner.start();
      // Stop does not affect chain property, so we can avoid making ineffective api calls.
      await chainOwner.stop();

      const localChain = chainOwner.chain;

      const bot = new WorkerBee({ explicitChain: localChain });

      await bot.start();

      // Validate endpoints to easily check that instances match
      const validChainInstance = bot.chain !== undefined && localChain !== undefined && bot.chain.endpointUrl === localChain.endpointUrl;

      await bot.delete();

      await chainOwner.delete();

      return validChainInstance;
    });

    expect(explicitChainTest).toEqual(true);
  });

  test("Should have a destroyable global module", async({ workerbeeTest }) => {
    await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee();

      await bot.delete();
    });
  });

  test("Should call proper events", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee();
      bot.on("error", console.error);

      let handlersCalled = 0;

      bot.on("start", () => { ++handlersCalled; });
      bot.on("stop", () => { ++handlersCalled; });

      await bot.start();
      await bot.stop();

      return handlersCalled;
    });

    expect(result).toStrictEqual(2);
  });

  test("Should be able to parse at least 2 blocks from the remote", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();
      bot.on("error", console.error);

      let blocksParsed = 0;
      bot.on("block", ({ block, number }) => {
        console.info(`Got block #${block.block_id} (${number})`);
        ++blocksParsed;
      });

      await bot.start();

      await Promise.race([
        new Promise(res => { setTimeout(res, hiveBlockInterval * 4); }),
        new Promise<void>(res => {
          bot.on("stop", res);
        })
      ]);

      await bot.stop();
      await bot.delete();

      return blocksParsed;
    }, HIVE_BLOCK_INTERVAL);

    expect(result).toBeGreaterThanOrEqual(1);
  });

  test("Should be able to use async iterator on bot", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();
      bot.on("error", console.error);

      let blocksParsed = 0;

      await Promise.race([
        /* eslint-disable-next-line no-async-promise-executor */
        new Promise<void>(async res => {
          await bot.start();

          for await(const { block, number } of bot) {
            console.info(`Got block #${block.block_id} (${number})`);
            ++blocksParsed;

            if(blocksParsed > 1)
              break;
          }

          res();
        }),
        new Promise(res => { setTimeout(res, hiveBlockInterval * 4); })
      ]);

      await bot.stop();
      await bot.delete();

      return blocksParsed;
    }, HIVE_BLOCK_INTERVAL);

    expect(result).toBeGreaterThanOrEqual(1);
  });

  test("Should be able to use block observer", async({ workerbeeTest }) => {
    await workerbeeTest(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();
      bot.on("error", console.error);

      await Promise.race([
        /* eslint-disable-next-line no-async-promise-executor */
        new Promise<void>(async res => {
          await bot.start();

          const block = await new Promise(blockResolve => {
            bot.once("block", blockResolve);
          }) as IBlockData;

          console.info(`Waiting for block: #${block.number + 1}`);
          const observer = bot.observe.block(block.number + 1);
          observer.subscribe({
            next() {
              console.info("Block detected");

              res();
            }
          });
        }),
        new Promise(res => { setTimeout(res, hiveBlockInterval * 4); })
      ]);

      await bot.stop();
      await bot.delete();
    }, HIVE_BLOCK_INTERVAL);
  });

  test("Should be able to use full manabar regeneration time observer", async({ workerbeeTest }) => {
    await workerbeeTest(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();
      bot.on("error", console.error);

      await Promise.race([
        /* eslint-disable-next-line no-async-promise-executor */
        new Promise<void>(async res => {
          await bot.start();

          console.info("Waiting for full manabar regeneration on initminer");

          const observer = bot.observe.accountFullManabar("initminer");
          observer.subscribe({
            next(acc: ApiAccount) {
              console.info(`Account has full manabar: ${acc.voting_manabar.current_mana}`);

              res();
            }
          });
        }),
        new Promise(res => { setTimeout(res, hiveBlockInterval * 4); })
      ]);

      await bot.stop();
      await bot.delete();
    }, HIVE_BLOCK_INTERVAL);
  });

  test.afterAll(async() => {
    await browser.close();
  });
});
