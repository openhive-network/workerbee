/* eslint-disable no-console */
import { ChromiumBrowser, chromium, expect } from "playwright/test";
import { test } from "../assets/jest-helper";

import { JsonRpcMock, resetMockCallIndexes } from "../assets/mock/api-mock";
import { resetCallIndexes } from "../assets/mock/jsonRpcMock";
import { createServer } from "../assets/mock/proxy-mock-server";

let browser: ChromiumBrowser;

let closeServer: () => Promise<void>;

test.describe("Realistic Scenarios with Live Data", () => {
  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: true
    });

    closeServer = await createServer(new JsonRpcMock(), 8000);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:8080/__tests__/assets/test.html", {
      waitUntil: "load",
    });

    resetMockCallIndexes();
    resetCallIndexes();
  });

  test("3.1 - Should be able to create real-time social dashboard", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest((bot, resolve, reject) => {
      let vote: { text: string, accountName: string, manabar: string } | undefined;
      let post: { text: string, accountName: string, manabar: string } | undefined;
      let comment: { text: string, accountName: string, manabar: string } | undefined;

      bot.observe.onPosts("gtg")
        .or.onComments("gtg")
        .or.onVotes("gtg")
        .provideAccounts("gtg")
        .provideManabarData(/* RC */ 2, "gtg")
        .subscribe({
          next(data) {
            data.posts.gtg?.forEach(({ operation }) => {
              post = {
                text: `Post: ${operation.author} - ${operation.title}`,
                accountName: JSON.stringify(data.accounts.gtg?.name),
                manabar: JSON.stringify(data.manabarData.gtg?.[2]?.currentMana)
              };
            });

            data.comments.gtg?.forEach(({ operation }) => {
              comment = {
                text: `Comment: ${operation.author} -> ${operation.parent_author}`,
                accountName: JSON.stringify(data.accounts.gtg?.name),
                manabar: JSON.stringify(data.manabarData.gtg?.[2]?.currentMana)
              };
            });

            data.votes.gtg?.forEach(({ operation }) => {
              vote = {
                text: `Vote: ${operation.voter} - ${operation.author}`,
                accountName: JSON.stringify(data.accounts.gtg?.name),
                manabar: JSON.stringify(data.manabarData.gtg?.[2]?.currentMana)
              };
            });

            if (post !== undefined && vote !== undefined && comment !== undefined)
              resolve([post, vote, comment]);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      {
        accountName: "\"gtg\"",
        manabar: "{\"low\":2125861720,\"high\":501074,\"unsigned\":true}",
        text: "Post: gtg - SkyTeam Airline Alliance - Official partner of HiveFest",
      },
      {
        accountName: "\"gtg\"",
        manabar: "{\"low\":2125861720,\"high\":501074,\"unsigned\":true}",
        text: "Vote: gtg - hbd.funder",
      },
      {
        accountName: "\"gtg\"",
        manabar: "{\"low\":2125861720,\"high\":501074,\"unsigned\":true}",
        text: "Comment: gtg -> purepinay",
      }
    ]);
  });

  test("3.2 - Should be able to create account health monitor", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest((bot, resolve, reject) => {
      let manabarData: string | undefined;

      bot.observe.onAccountsBalanceChange(false, "gtg")
        .or.onAccountsMetadataChange("gtg")
        .or.onAccountsManabarPercent(0, 100, "gtg")
        .provideAccounts("gtg")
        .subscribe({
          next(data) {
            manabarData = `Reached ${data.manabarData.gtg?.[0]?.percent}% of manabar`;

            if (
              manabarData !== undefined &&
              // eslint-disable-next-line max-len
              JSON.stringify(data.accounts.gtg?.jsonMetadata) === JSON.stringify({profile:{witness_description:"Gandalf the Grey, building Hive, improving Hive infrastructure.", profile_image:"https://grey.house/img/grey_4.jpg", name:"Gandalf the Grey", about:"IT Wizard, Hive Witness", location:"Hive", version:2}}) &&
              data.accounts.gtg?.balance.HBD.savings.amount === "3468"
            )
              resolve([manabarData, data.accounts.gtg?.jsonMetadata, data.accounts.gtg?.balance.HBD.savings.amount]);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Reached 100% of manabar",
      {
        profile: {
          about: "IT Wizard, Hive Witness",
          location: "Hive",
          name: "Gandalf the Grey",
          profile_image: "https://grey.house/img/grey_4.jpg",
          version: 2,
          witness_description: "Gandalf the Grey, building Hive, improving Hive infrastructure.",
        },
      },
      "3468" // HBD savings balance
    ]);
  });

  test("3.3 - Should be able to create market alert system", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<number>((bot, resolve, reject) => {
      bot.observe.onFeedPriceChange(95)
        .or.onFeedPriceNoChange(1)
        .or.onWitnessesMissedBlocks(5, "gtg")
        .provideFeedPriceData()
        .subscribe({
          next(data) {
            let percentChange = 0;

            const priceHistoryArray = Array.from(data.feedPrice.priceHistory);

            const price1 = Number.parseInt(priceHistoryArray[0].base!.amount) / Number.parseInt(priceHistoryArray[0].quote!.amount);
            const price2 = Number.parseInt(priceHistoryArray[1].base!.amount) / Number.parseInt(priceHistoryArray[1].quote!.amount);

            percentChange = Math.abs(price1 - price2) / price2 * 100;

            resolve(percentChange);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual(134.30962343096238);
  });

  test("3.5 - Should be able to create investment portfolio monitor", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const marketOperations: string[] = [];

      bot.observe.onAccountsBalanceChange(true, "gtg", "blocktrades")
        .or.onWhaleAlert(bot.chain!.hiveCoins(1000))
        .or.onExchangeTransfer()
        .provideAccounts("gtg", "blocktrades")
        .subscribe({
          next(data) {
            data.exchangeTransferOperations.forEach(({ operation }) => {
              marketOperations.push(`Exchange transfer: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
            });

            data.whaleOperations.forEach(({ operation }) => {
              marketOperations.push(`Whale alert: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
            });

            if (marketOperations.length >= 2)
              resolve(marketOperations);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual(["Exchange transfer: bdhivesteem -> gtg (1000)", "Whale alert: blocktrades -> gtg (10000000)"]);
  });

  test("3.6 - Should be able to create content aggregation service", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const contentOperations: string[] = [];

      bot.observe.onPosts("mtyszczak")
        .or.onPosts("fwaszkiewicz")
        .or.onReblog("thebeedevs")
        .subscribe({
          next(data) {
            data.posts.mtyszczak?.forEach(({ operation }) => {
              contentOperations.push(`Post: ${operation.author} - ${operation.title}`);
            });

            data.posts.fwaszkiewicz?.forEach(({ operation }) => {
              contentOperations.push(`Post: ${operation.author} - ${operation.title}`);
            });

            data.reblogs.thebeedevs?.forEach(({ operation }) => {
              contentOperations.push(`Reblog: ${operation.account} -> ${operation.author}/${operation.permlink}`);
            });

            if (contentOperations.length >= 3)
              resolve(contentOperations);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Post: mtyszczak - Write on Hive, Read Everywhere!",
      "Post: fwaszkiewicz - Hi To Hive! 🐝",
      "Reblog: thebeedevs -> fwaszkiewicz/hi-to-hive",
    ]);
  });

  test("3.7 - Should be able to create engagement optimization bot", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string>((bot, resolve, reject) => {
      const content: string[] = [];

      bot.observe.onAccountsManabarPercent(/* UPVOTE */ 0, 90, "gtg")
        .or.onPosts("fwaszkiewicz")
        .or.onComments("fwaszkiewicz")
        .provideManabarData(/* UPVOTE */ 0, "gtg")
        .subscribe({
          next(data) {
            data.posts.fwaszkiewicz?.forEach(({ operation }) => {
              content.push(`Post: ${operation.author} - ${operation.title}`);
            });

            data.comments.fwaszkiewicz?.forEach(({ operation }) => {
              content.push(`Comment: ${operation.author} -> ${operation.parent_author}`);
            });

            if (data.manabarData.gtg![0]!.percent >= 90 && content.length >= 2)
              resolve(`Reached 90% of manabar for upvote: ${data.manabarData.gtg![0]!.percent}, available content: ${content}`);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual("Reached 90% of manabar for upvote: 100, available content: Post: fwaszkiewicz - Hi To Hive! 🐝,Comment: fwaszkiewicz -> mtyszczak");
  });

  test.afterAll(async () => {
    await browser.close();
    await closeServer();
  });
});
