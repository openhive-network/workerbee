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
        manabar: "{\"low\":1965705338,\"high\":37491,\"unsigned\":true}",
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

    expect(result).toEqual([
      "Exchange transfer: mxchive -> inhivepool (23890)",
      "Exchange transfer: bdhivesteem -> gtg (1000)",
      "Whale alert: mxchive -> inhivepool (23890)",
      "Whale alert: blocktrades -> gtg (10000000)"
    ]);
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

  test("4.1 - Should be able to perform complete account analysis", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      bot.observe.onBlock()
        .provideAccounts("gtg")
        .provideRcAccounts("gtg")
        .provideManabarData(/* RC */2, "gtg")
        .provideManabarData(/* UPVOTE */0, "gtg")
        .provideBlockData()
        .provideFeedPriceData()
        .subscribe({
          next(data) {
            content.push(`Account: ${data.accounts.gtg?.name}, Balance: ${data.accounts.gtg?.balance.HBD.savings.amount}`);
            content.push(`RC mana: ${data.rcAccounts.gtg?.rcManabar.currentMana}`);
            content.push(`UPVOTE mana: ${data.manabarData.gtg?.[0]?.currentMana}`);
            content.push(`Block number: ${data.block.number}`);
            content.push(`Feed price: ${Array.from(data.feedPrice.priceHistory)[0].base!.amount}/${Array.from(data.feedPrice.priceHistory)[0].quote!.amount}`);

            if (content.length >= 5)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Account: gtg, Balance: 0",
      "RC mana: 161024584599674",
      "UPVOTE mana: 2897631713028020",
      "Block number: 97477291",
      "Feed price: 280/1000"
    ]);
  });

  test("4.2 - Should be able to perform multi-account comparison", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      bot.observe.onBlock()
        .provideAccounts("gtg", "blocktrades", "thebeedevs")
        .provideManabarData(/* RC */2, "gtg", "blocktrades", "thebeedevs")
        .provideWitnesses("gtg", "blocktrades")
        .subscribe({
          next(data) {
            content.push(`Account: ${data.accounts.gtg?.name}, Balance: ${data.accounts.gtg?.balance.HBD.savings.amount}`);
            content.push(`RC mana: ${data.manabarData.gtg?.[2]?.currentMana}`);
            content.push(`Witnesses missed blocks: ${data.witnesses.gtg?.totalMissedBlocks}`);

            content.push(`Account: ${data.accounts.blocktrades?.name}, Balance: ${data.accounts.blocktrades?.balance.HBD.savings.amount}`);
            content.push(`RC mana: ${data.manabarData.blocktrades?.[2]?.currentMana}`);
            content.push(`Witnesses missed blocks: ${data.witnesses.blocktrades?.totalMissedBlocks}`);

            content.push(`Account: ${data.accounts.thebeedevs?.name}, Balance: ${data.accounts.thebeedevs?.balance.HBD.savings.amount}`);
            content.push(`RC mana: ${data.manabarData.thebeedevs?.[2]?.currentMana}`);

            if (content.length >= 8)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Account: gtg, Balance: 0",
      "RC mana: 161024584599674",
      "Witnesses missed blocks: 988",
      "Account: blocktrades, Balance: 130076015",
      "RC mana: 15564167323386971",
      "Witnesses missed blocks: 3728",
      "Account: thebeedevs, Balance: 215216",
      "RC mana: 3851154925254"
    ]);
  });

  test("4.3 - Should be able to create comprehensive market analysis", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      bot.observe.onBlock()
        .or.onInternalMarketOperation()
        .or.onExchangeTransfer()
        .provideBlockData()
        .provideFeedPriceData()
        .provideAccounts("gtg", "blocktrades")
        .subscribe({
          next(data) {
            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Internal market operation: owner: ${operation.owner}, order id: ${operation.orderId}, block : ${data.block.number}`);
            });

            data.exchangeTransferOperations.forEach(({ operation }) => {
              content.push(`Exchange transfer: ${operation.from} -> ${operation.to} (${operation.amount.amount}), block: ${data.block.number}`);
            });

            if (content.length >= 2)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Internal market operation: owner: honeybot, order id: 1485200410, block : 97477294",
      "Exchange transfer: mxchive -> inhivepool (23890), block: 97477294",
      "Exchange transfer: bdhivesteem -> gtg (1000), block: 97477294"
    ]);
  });

  test("4.4 - Should be able to create social network analysis", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      bot.observe.onFollow("gtg")
        .or.onFollow("blocktrades")
        .or.onReblog("gtg")
        .or.onMention("gtg")
        .provideAccounts("gtg", "blocktrades")
        .provideManabarData(/* RC */ 2, "gtg", "blocktrades")
        .subscribe({
          next(data) {
            data.follows.gtg?.forEach(({ operation }) => {
              content.push(`Follow: ${operation.follower} -> ${operation.following}, (${data.accounts.gtg?.name})`);
            });

            data.follows.blocktrades?.forEach(({ operation }) => {
              content.push(`Follow: ${operation.follower} -> ${operation.following}, (${data.accounts.blocktrades?.name})`);
            });

            data.reblogs.gtg?.forEach(({ operation }) => {
              content.push(`Reblog: ${operation.account} -> ${operation.author}/${operation.permlink} (${data.accounts.gtg?.name})`);
            });

            data.mentioned.gtg?.forEach((operation) => {
              content.push(`Mention: ${operation.author} -> ${operation.permlink} (${data.accounts.gtg?.name})`);
            });

            if (content.length >= 4)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Follow: gtg -> thebeedevs, (gtg)",
      "Follow: blocktrades -> thebeedevs, (blocktrades)",
      "Reblog: gtg -> fwaszkiewicz/hi-to-hive (gtg)",
      "Mention: mtyszczak -> write-on-hive-read-everywhere (gtg)",
      "Mention: fwaszkiewicz -> hi-to-hive (gtg)"
    ]);
  });

  test("4.5 - Should be able to create content performance dashboard", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      bot.observe.onPosts("gtg")
        .or.onComments("gtg")
        .or.onVotes("gtg")
        .or.onReblog("gtg")
        .provideAccounts("gtg")
        .provideManabarData(/* UPVOTE */ 0, "gtg")
        .provideBlockData()
        .subscribe({
          next(data) {
            data.posts.gtg?.forEach(({ operation }) => {
              content.push(`Post: ${operation.author} - ${operation.title} (${data.accounts.gtg?.name}) (${data.manabarData.gtg?.[0]?.currentMana})`);
            });

            data.comments.gtg?.forEach(({ operation }) => {
              // eslint-disable-next-line max-len
              content.push(`Comment: ${operation.author} -> ${operation.parent_author} (${data.accounts.gtg?.name}) (${data.manabarData.gtg?.[0]?.currentMana})`);
            });

            data.votes.gtg?.forEach(({ operation }) => {
              content.push(`Vote: ${operation.voter} - ${operation.author} (${data.accounts.gtg?.name}) (${data.manabarData.gtg?.[0]?.currentMana})`);
            });

            data.reblogs.gtg?.forEach(({ operation }) => {
              // eslint-disable-next-line max-len
              content.push(`Reblog: ${operation.account} -> ${operation.author}/${operation.permlink} (${data.accounts.gtg?.name}) (${data.manabarData.gtg?.[0]?.currentMana})`);
            });

            if (content.length >= 4)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Vote: gtg - hbd.funder (gtg) (2897631713028020)",
      "Comment: gtg -> purepinay (gtg) (18469160006473)",
      "Reblog: gtg -> fwaszkiewicz/hi-to-hive (gtg) (18469160006473)",
      "Post: gtg - SkyTeam Airline Alliance - Official partner of HiveFest (gtg) (18469160006473)"
    ]);
  });

  test.afterAll(async () => {
    await browser.close();
    await closeServer();
  });
});
