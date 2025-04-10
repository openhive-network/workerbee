/* eslint-disable no-console */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ReplyOperation, ApiAccount } from "@hiveio/wax";
import { expect } from "@playwright/test";
import { ChromiumBrowser, ConsoleMessage, chromium } from "playwright";

import type { IStartConfiguration } from "../../src/bot";
import type { IBroadcastData, ITransactionData } from "../../src/index";

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

  test("Should have a destroyable global module", async({ workerbeeTest }) => {
    await workerbeeTest(({ WorkerBee }) => {
      const bot = new WorkerBee();

      bot.delete();
    });
  });

  test("Allow to broadcast to mirronet chain", async({ workerbeeTest }) => {
    const broadcastTest = await workerbeeTest(async({ WorkerBee, wax, beekeeperFactory }) => {

      /*
       * Prepare helper WorkerBee instance just to provide IHiveChainInterface instance.
       * It is a problem in PW tests to reference whole wax, since its dependencies need to be declared at importmap in test.html
       */
      const customWaxConfig = { apiEndpoint: "https://api.fake.openhive.network", chainId: "42" };
      const customConfig: IStartConfiguration = { chainOptions: customWaxConfig };

      const chainOwner = new WorkerBee(customConfig);
      // Call start just to initialize chain member in WorkerBee object.
      await chainOwner.start();
      // Stop does not affect chain property, so we can avoid making ineffective api calls.
      chainOwner.stop();

      const localChain = chainOwner.chain!;

      const bot = new WorkerBee({ explicitChain: localChain });

      const newTx = await localChain.createTransaction();

      newTx.pushOperation(new wax.ReplyOperation({author: "gtg", permlink: `re-${Date.now()}`, parentAuthor: "hbd.funder",
        parentPermlink: "re-upvote-this-post-to-fund-hbdstabilizer-20250312t045515z", title: "test", body: "Awesome test!",
        maxAcceptedPayout: localChain.hbdCoins(1000000), percentHbd: 9000, allowVotes: true, allowCurationRewards: true}));

      const bkInstance = await beekeeperFactory({inMemory: true});
      const bkSession = bkInstance.createSession("salt and pepper");

      const {wallet} = await bkSession.createWallet("temp", "pass", true);
      const publicKey = await wallet.importKey("5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n");

      /// Intentionally sign using legacy method
      const legacySigDigest = newTx.legacy_sigDigest;
      const signature = await wallet.signDigest(publicKey, legacySigDigest);
      newTx.sign(signature);

      let signatureIsMatching: boolean = false;

      await Promise.race([
        /* eslint-disable-next-line no-async-promise-executor */
        new Promise<void>(async res => {
          await bot.start();

          const broadcastResultObserver = await bot.broadcast(newTx, { throwAfter: "+20s"});

          const txObserver = broadcastResultObserver.subscribe({
            next (data: IBroadcastData) {
              console.log(`Received broadcast data: ${JSON.stringify(data.transaction)}`);
              if(data.transaction.signatures[0] !== signature)
                throw new Error("Invalid signature in broadcast result");

              signatureIsMatching = true;
              txObserver.unsubscribe();
              res();
            },
            error(err) {
              console.error(err);
              throw new Error("Transaction broadcast failure");
            }
          });
        }),
        new Promise(res => { setTimeout(res, 15000); })
      ]);

      bot.delete();
      chainOwner.delete();

      return signatureIsMatching;
    });

    expect(broadcastTest).toEqual(true);
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
      chainOwner.stop();

      const localChain = chainOwner.chain;

      const bot = new WorkerBee({ explicitChain: localChain });

      await bot.start();

      // Validate endpoints to easily check that instances match
      const validChainInstance = bot.chain !== undefined && localChain !== undefined && bot.chain.endpointUrl === localChain.endpointUrl;

      bot.delete();

      chainOwner.delete();

      return validChainInstance;
    });

    expect(explicitChainTest).toEqual(true);
  });

  test("Should be able to parse at least 2 blocks from the remote using block observer", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();

      let blocksParsed = 0;
      const observer = bot.observe.onBlock().subscribe({
        next(data) {
          console.info(`Got block #${data.block.number}`);
          ++blocksParsed;
        },
        error(err) {
          console.error(err);
        }
      });

      await bot.start();

      await new Promise(res => { setTimeout(res, hiveBlockInterval * 2); });

      observer.unsubscribe();

      return blocksParsed;
    }, HIVE_BLOCK_INTERVAL);

    expect(result).toBeGreaterThanOrEqual(1);
  });

  test("Should be able to use async iterator on bot", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();

      let blocksParsed = 0;

      await Promise.race([
        /* eslint-disable-next-line no-async-promise-executor */
        new Promise<void>(async res => {
          await bot.start();

          for await(const { number } of bot) {
            console.info(`Got block #${number}`);
            ++blocksParsed;

            if(blocksParsed > 1)
              break;
          }

          res();
        }),
        new Promise((_, rej) => { setTimeout(rej, hiveBlockInterval * 3, new Error("Test timeout")); })
      ]);

      bot.stop();
      bot.delete();

      return blocksParsed;
    }, HIVE_BLOCK_INTERVAL);

    expect(result).toBeGreaterThanOrEqual(1);
  });

  test("Should be able to use full manabar regeneration time observer", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();

      const result = await Promise.race([
        new Promise<string>(res => {
          bot.start();

          console.info("Waiting for full manabar regeneration on initminer");

          const observer = bot.observe.onAccountFullManabar("initminer").provideRcAccounts("initminer");
          observer.subscribe({
            next(data) {
              if (!data.rcAccounts["initminer"])
                return;

              console.info(`Account has full manabar: ${data.rcAccounts["initminer"].rcManabar.currentMana}`);

              res(data.rcAccounts["initminer"].rcManabar.currentMana.toString());
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<string>((_, rej) => { setTimeout(rej, hiveBlockInterval * 2, new Error("Test timeout")); })
      ]);

      bot.stop();
      bot.delete();

      return result;
    }, HIVE_BLOCK_INTERVAL);

    expect(result.length).toBeGreaterThan(0);
  });

  test("Should be able to evaluate or condition in first statement", async({ workerbeeTest }) => {
    await workerbeeTest(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();

      await Promise.race([
        new Promise<void>(res => {
          bot.start();

          const observer = bot.observe.onAccountFullManabar("initminer").or.onBlockNumber(1);
          observer.subscribe({
            next() {
              res();
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<void>((_, rej) => { setTimeout(rej, hiveBlockInterval * 2, new Error("Test timeout")); })
      ]);

      bot.stop();
      bot.delete();
    }, HIVE_BLOCK_INTERVAL);
  });

  test("Should be able to evaluate or condition in second statement", async({ workerbeeTest }) => {
    await workerbeeTest(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();

      await Promise.race([
        new Promise<void>(res => {
          bot.start();

          const observer = bot.observe.onBlockNumber(1).or.onAccountFullManabar("initminer");
          observer.subscribe({
            next() {
              res();
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<void>((_, rej) => { setTimeout(rej, hiveBlockInterval * 2, new Error("Test timeout")); })
      ]);

      bot.stop();
      bot.delete();
    }, HIVE_BLOCK_INTERVAL);
  });

  test("Should call next() only once when all or statements evaluate to true", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }, hiveBlockInterval) => {
      const bot = new WorkerBee();

      let calls = 0;
      let res: () => void;

      await Promise.race([
        new Promise<void>(_res => {
          res = _res;
          bot.start();

          const observer = bot.observe.onBlock().or.onBlock().or.onBlock().or.onBlock().or.onBlock();
          observer.subscribe({
            next() {
              ++calls;
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<void>(() => { setTimeout(res, hiveBlockInterval * 2); })
      ]);

      bot.stop();
      bot.delete();

      return calls;
    }, HIVE_BLOCK_INTERVAL);

    // We accept 3 block events triggerred at most - 2 block intervals + 1 for any possible race condition
    expect(result).toBeLessThanOrEqual(3);
  });

  test("Should be able to parse blocks from the past", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee();
      await bot.start();

      let calls = 0;
      await new Promise<void>(resolve => {
        bot.providePastOperations(500017, 500020).onBlock().provideBlockHeaderData().subscribe({
          next(data) {
            console.log(`Got block #${data.block.number}`);

            ++calls;
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      })

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBeGreaterThanOrEqual(3);
  });

  test("Should be able to parse blocks from the past - more than 1000", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee();
      await bot.start();

      let calls = 0;
      await new Promise<void>(resolve => {
        bot.providePastOperations(500017, 501020).onBlock().subscribe({
          next() {
            ++calls;
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      })

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBeGreaterThanOrEqual(1002);
  });

  test("Should be able to parse blocks from the past - impacted accounts", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee();
      await bot.start();

      let calls = 0;
      await new Promise<void>(resolve => {
        bot.providePastOperations(94704950, 94705000).provideBlockData().onImpactedAccounts("lolzbot").subscribe({
          next(data) {
            if(!data.impactedAccounts["lolzbot"])
              return;

            data.impactedAccounts["lolzbot"].forEach(({ transaction }) => {
              console.log(`Got transaction #${transaction.id} for lolzbot in block #${data.block.number}`);

              ++calls;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      })

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBe(6);
  });

  test("Should be able to parse blocks from the past - more than relative time", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ WorkerBee }) => {
      const bot = new WorkerBee();
      await bot.start();

      let calls = 0;
      /* eslint-disable-next-line no-async-promise-executor */
      await new Promise<void>(async resolve => {
        const observer = await bot.providePastOperations("-11s");

        observer.onBlock().provideBlockData().subscribe({
          next(data) {
            console.log(`Got block #${data.block.number}`);

            ++calls;
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      })

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBeGreaterThanOrEqual(3);
  });

  test.afterAll(async() => {
    await browser.close();
  });
});
