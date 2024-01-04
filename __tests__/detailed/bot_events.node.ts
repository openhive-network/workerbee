import { test, expect } from "@playwright/test";

import type { IBlockData } from "../../src/interfaces";
import { WorkerBee } from "../../src/bot.node";

const HIVE_BLOCK_INTERVAL = 3000;

test.describe("WorkerBee Bot events test in Node.js", () => {
  test("Should have a destroyable global module", async() => {
    const bot = new WorkerBee();

    await bot.delete();
  });

  test("Should call proper events", async() => {
    const bot = new WorkerBee();
    bot.on("error", console.error);

    let handlersCalled = 0;

    bot.on('start', () => { ++handlersCalled; });
    bot.on('stop', () => { ++handlersCalled; });

    await bot.start();
    await bot.stop();

    expect(handlersCalled).toStrictEqual(2);
  });

  test("Should be able to parse at least 2 blocks from the remote", async() => {
    const bot = new WorkerBee();
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

    expect(blocksParsed).toBeGreaterThanOrEqual(1);
  });

  test("Should be able to use async iterator on bot", async() => {
    const bot = new WorkerBee();
    bot.on("error", console.error);

    let blocksParsed = 0;

    await Promise.race([
      new Promise<void>(async(res) => {
        await bot.start();

        for await(const { block, number } of bot) {
          console.info(`Got block #${block.block_id} (${number})`);
          ++blocksParsed;

          if(blocksParsed > 1)
            break;
        }

        res();
      }),
      new Promise((res) => { setTimeout(res, HIVE_BLOCK_INTERVAL * 4); }),
    ]);

    await bot.stop();
    await bot.delete();

    expect(blocksParsed).toBeGreaterThanOrEqual(1);
  });

  test("Should be able to use block observer", async() => {
    const bot = new WorkerBee();
    bot.on("error", console.error);

    await Promise.race([
      new Promise<void>(async(res) => {
        await bot.start();

        const block = await new Promise(blockResolve => {
          bot.once("block", blockResolve);
        }) as IBlockData;

        console.info(`Waiting for block: #${block.number + 1}`);
        const observer = bot.observe.block(block.number + 1);
        observer.subscribe({
          next() {
            console.info('Block detected');

            res();
          }
        });
      }),
      new Promise((res) => { setTimeout(res, HIVE_BLOCK_INTERVAL * 4); }),
    ]);

    await bot.stop();
    await bot.delete();
  });

  test("Should be able to use full manabar regeneration time observer", async() => {
    const bot = new WorkerBee();
    bot.on("error", console.error);

    await Promise.race([
      new Promise<void>(async(res) => {
        await bot.start();

        console.info(`Waiting for full manabar regeneration on initminer`);

        const observer = bot.observe.accountFullManabar("initminer");
        observer.subscribe({
          next(acc) {
            console.info(`Account has full manabar: ${acc.voting_manabar.current_mana}`);

            res();
          }
        });
      }),
      new Promise((res) => { setTimeout(res, HIVE_BLOCK_INTERVAL * 4); }),
    ]);

    await bot.stop();
    await bot.delete();
  });
});
