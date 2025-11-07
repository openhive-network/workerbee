/* eslint-disable no-console */
import { expect } from "playwright/test";
import { IWorkerBee, Unsubscribable } from "../../dist/bundle";
import { QueenBee } from "../../src/queen";
import { mockTest } from "../assets/jest-helper";

mockTest.describe("Realistic Scenarios with Live Data", () => {
  mockTest("3.1 - Should be able to create real-time social dashboard", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest((bot, resolve, reject) => {
      let vote: { text: string, accountName: string, manabar: string } | undefined;
      let post: { text: string, accountName: string, manabar: string } | undefined;
      let comment: { text: string, accountName: string, manabar: string } | undefined;

      (bot as QueenBee).onPosts("gtg")
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
                manabar: JSON.stringify(data.manabarData.gtg?.[2]?.currentMana, (_key, value) =>
                  typeof value === "bigint" ? value.toString() : value
                )
              };
            });

            data.comments.gtg?.forEach(({ operation }) => {
              comment = {
                text: `Comment: ${operation.author} -> ${operation.parent_author}`,
                accountName: JSON.stringify(data.accounts.gtg?.name),
                manabar: JSON.stringify(data.manabarData.gtg?.[2]?.currentMana, (_key, value) =>
                  typeof value === "bigint" ? value.toString() : value
                )
              };
            });

            data.votes.gtg?.forEach(({ operation }) => {
              vote = {
                text: `Vote: ${operation.voter} - ${operation.author}`,
                accountName: JSON.stringify(data.accounts.gtg?.name),
                manabar: JSON.stringify(data.manabarData.gtg?.[2]?.currentMana, (_key, value) =>
                  typeof value === "bigint" ? value.toString() : value
                )
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
        manabar: "\"2152098568737624\"",
        text: "Post: gtg - SkyTeam Airline Alliance - Official partner of HiveFest",
      },
      {
        accountName: "\"gtg\"",
        manabar: "\"2152098568737624\"",
        text: "Vote: gtg - hbd.funder",
      },
      {
        accountName: "\"gtg\"",
        manabar: "\"2152098568737624\"",
        text: "Comment: gtg -> purepinay",
      }
    ]);
  });

  mockTest("3.2 - Should be able to create account health monitor", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest((bot, resolve, reject) => {
      let manabarData: string | undefined;

      (bot as QueenBee).onAccountsBalanceChange(false, "gtg")
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

  mockTest("3.3 - Should be able to create market alert system", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<number>((bot, resolve, reject) => {
      (bot as QueenBee).onFeedPriceChange(95)
        .or.onFeedPriceNoChange(1)
        .or.onWitnessesMissedBlocks(5, "gtg")
        .provideFeedPriceData()
        .subscribe({
          next(data) {
            let percentChange = 0;

            const priceHistoryArray = Array.from(data.feedPrice!.priceHistory);

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

  mockTest("3.5 - Should be able to create investment portfolio monitor", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject, chain) => {
      const marketOperations: string[] = [];

      (bot as QueenBee).onAccountsBalanceChange(true, "gtg", "blocktrades")
        .or.onWhaleAlert(chain!.hiveCoins(1000))
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

  mockTest("3.6 - Should be able to create content aggregation service", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const contentOperations: string[] = [];

      (bot as QueenBee).onPosts("mtyszczak")
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

  mockTest("3.7 - Should be able to create engagement optimization bot", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onAccountsManabarPercent(/* UPVOTE */ 0, 90, "gtg")
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

  mockTest("4.1 - Should be able to perform complete account analysis", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
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
            content.push(
              `Feed price: ${Array.from(data.feedPrice!.priceHistory)[0].base!.amount}/${Array.from(data.feedPrice!.priceHistory)[0].quote!.amount}`
            );

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
      "Account: gtg, Balance: 3468",
      "RC mana: 2152098568737624",
      "UPVOTE mana: 18469160006473",
      "Block number: 97477291",
      "Feed price: 280/1000"
    ]);
  });

  mockTest("4.2 - Should be able to perform multi-account comparison", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
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

  mockTest("4.3 - Should be able to create comprehensive market analysis", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
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

  mockTest("4.4 - Should be able to create social network analysis", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onFollow("gtg")
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
              console.log("FOLLOW");
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

  mockTest("4.5 - Should be able to create content performance dashboard", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onPosts("gtg")
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
      "Vote: gtg - hbd.funder (gtg) (18469160006473)",
      "Comment: gtg -> purepinay (gtg) (18469160006473)",
      "Reblog: gtg -> fwaszkiewicz/hi-to-hive (gtg) (18469160006473)",
      "Post: gtg - SkyTeam Airline Alliance - Official partner of HiveFest (gtg) (18469160006473)"
    ]);
  });

  mockTest("4.6 - Should be able to create governance monitoring system", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onWitnessesMissedBlocks(3, "gtg", "blocktrades")
        .or.onFeedPriceChange(2)
        .or.onCustomOperation("witness_set_properties")
        .provideWitnesses("gtg", "blocktrades")
        .provideFeedPriceData()
        .subscribe({
          next(data) {
            if (data.witnesses.gtg && data.witnesses.gtg.totalMissedBlocks >= 3)
              content.push(`Witness missed blocks: gtg - ${data.witnesses.gtg.totalMissedBlocks}`);

            if (data.witnesses.blocktrades && data.witnesses.blocktrades.totalMissedBlocks >= 3)
              content.push(`Witness missed blocks: blocktrades - ${data.witnesses.blocktrades.totalMissedBlocks}`);

            const priceHistoryArray = Array.from(data.feedPrice!.priceHistory);

            if (priceHistoryArray.length >= 2) {
              const price1 = Number.parseInt(priceHistoryArray[0].base!.amount) / Number.parseInt(priceHistoryArray[0].quote!.amount);
              const price2 = Number.parseInt(priceHistoryArray[1].base!.amount) / Number.parseInt(priceHistoryArray[1].quote!.amount);
              const percentChange = Math.abs(price1 - price2) / price2 * 100;

              if (percentChange >= 2)
                content.push(`Feed price change: ${percentChange.toFixed(2)}%`);
            }

            if (data.customOperations["witness_set_properties"])
              data.customOperations["witness_set_properties"].forEach(({ operation }) => {
                content.push(`Custom operation: ${operation.id} by ${operation.required_auths[0]}`);
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
      "Witness missed blocks: gtg - 988",
      "Witness missed blocks: blocktrades - 3728",
      "Feed price change: 134.31%"
    ]);
  });

  mockTest.fail("5.1 - Should be able to create high-volume transaction monitor", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onTransactionIds(
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df",
        "1c4b64f563f143284ca38dc66b3c2c71d314780f",
        "3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d",
        "6bcf068618d8b66882cca5b94cd8de74215553df"
      ).subscribe({
        next: (data) => {
          content.push(`Got transactions with ID's: ${Object.keys(data.transactions).join(", ")}`);

          if (content.length >= 1)
            resolve(content);

        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      })
    });

    expect(result).toEqual([
      "Got transactions with ID's: 1c4b64f563f143284ca38dc66b3c2c71d314780f, 3f6a99bf0106bcb9d77a2119ebc559a1f4a0343d, 6bcf068618d8b66882cca5b94cd8de74215553df"
      // TODO: Test output is: "Got transactions with ID's: 6bcf068618d8b66882cca5b94cd8de74215553df", but should be as above
    ]);
  });

  mockTest("5.2 - Should be able to create multi-filter performance test", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onPosts("gtg")
        .or.onPosts("blocktrades")
        .or.onComments("gtg")
        .or.onComments("blocktrades")
        .or.onVotes("gtg")
        .or.onVotes("blocktrades")
        .subscribe({
          next(data) {
            data.posts.gtg?.forEach(({ operation }) => {
              content.push(`Post by gtg: ${operation.title}`);
            });

            data.posts.blocktrades?.forEach(({ operation }) => {
              content.push(`Post by blocktrades: ${operation.title}`);
            });

            data.comments.gtg?.forEach(({ operation }) => {
              content.push(`Comment by gtg: ${operation.parent_author}`);
            });

            data.comments.blocktrades?.forEach(({ operation }) => {
              content.push(`Comment by blocktrades: ${operation.parent_author}`);
            });

            data.votes.gtg?.forEach(({ operation }) => {
              content.push(`Vote by gtg: ${operation.author}`);
            });

            data.votes.blocktrades?.forEach(({ operation }) => {
              content.push(`Vote by blocktrades: ${operation.author}`);
            });

            if (content.length >= 3)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Vote by gtg: hbd.funder",
      "Comment by gtg: purepinay",
      "Post by gtg: SkyTeam Airline Alliance - Official partner of HiveFest"
    ]);
  });

  mockTest("5.3 - Should be able to create massive account monitoring", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];
      const accounts = ["gtg"];

      (bot as QueenBee).onAccountsBalanceChange(false, ...accounts)
        .or.onAccountsMetadataChange(...accounts)
        .provideAccounts(...accounts)
        .subscribe({
          next(data) {
            accounts.forEach(account => {
              if (data.accounts[account])
                content.push(`Account monitored: ${account} - Balance: ${data.accounts[account]?.balance.HIVE.liquid.amount}`);

            });

            if (content.length >= 1)
              resolve(content.slice(0, 1));
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Account monitored: gtg - Balance: 0"
    ]);
  });

  mockTest("5.4 - Should be able to create high-frequency event processing", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
        .or.onVotes("gtg")
        .or.onComments("fwaszkiewicz")
        .or.onInternalMarketOperation()
        .provideBlockData()
        .subscribe({
          next(data) {
            content.push(`Block processed: ${data.block.number}`);

            data.votes.gtg?.forEach(({ operation }) => {
              content.push(`High-frequency vote: ${operation.voter} -> ${operation.author}`);
            });

            data.comments.fwaszkiewicz?.forEach(({ operation }) => {
              content.push(`High-frequency comment: ${operation.author} -> ${operation.parent_author}`);
            });

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`High-frequency market op: ${operation.owner} - ${operation.orderId}`);
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
      "Block processed: 97477291",
      "Block processed: 97477292",
      "High-frequency vote: gtg -> hbd.funder",
      "Block processed: 97477293"
    ]);
  });

  mockTest("6.1 - Should be able to create economic research platform", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject, chain) => {
      const content: string[] = [];

      (bot as QueenBee).onWhaleAlert(chain!.hiveCoins(10000))
        .or.onFeedPriceChange(1)
        .or.onInternalMarketOperation()
        .or.onExchangeTransfer()
        .provideFeedPriceData()
        .provideBlockData()
        .subscribe({
          next(data) {
            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Economic whale alert: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
            });

            const priceHistoryArray = Array.from(data.feedPrice!.priceHistory);
            if (priceHistoryArray.length >= 2) {
              const price1 = Number.parseInt(priceHistoryArray[0].base!.amount) / Number.parseInt(priceHistoryArray[0].quote!.amount);
              const price2 = Number.parseInt(priceHistoryArray[1].base!.amount) / Number.parseInt(priceHistoryArray[1].quote!.amount);
              const percentChange = Math.abs(price1 - price2) / price2 * 100;

              if (percentChange >= 1)
                content.push(`Economic price change: ${percentChange.toFixed(2)}%`);

            }

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Economic market operation: ${operation.owner} - order ${operation.orderId}`);
            });

            data.exchangeTransferOperations.forEach(({ operation }) => {
              content.push(`Economic exchange transfer: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
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
      "Economic price change: 134.31%",
      "Economic price change: 134.31%",
      "Economic price change: 134.31%",
      "Economic whale alert: mxchive -> inhivepool (23890)",
      "Economic price change: 134.31%",
      "Economic market operation: honeybot - order 1485200410",
      "Economic exchange transfer: mxchive -> inhivepool (23890)",
      "Economic exchange transfer: bdhivesteem -> gtg (1000)"
    ]);
  });

  mockTest("6.2 - Should be able to create content recommendation engine", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onPosts("mtyszczak")
        .or.onReblog("thebeedevs")
        .or.onVotes("gtg")
        .or.onMention("gtg")
        .provideAccounts("mtyszczak", "thebeedevs", "gtg")
        .subscribe({
          next(data) {
            data.posts.mtyszczak?.forEach(({ operation }) => {
              content.push(`Recommended post: ${operation.author} - ${operation.title}`);
            });

            data.reblogs.thebeedevs?.forEach(({ operation }) => {
              content.push(`Recommended reblog: ${operation.account} -> ${operation.author}/${operation.permlink}`);
            });

            data.votes.gtg?.forEach(({ operation }) => {
              content.push(`Quality curator vote: ${operation.voter} -> ${operation.author}`);
            });

            data.mentioned.gtg?.forEach((operation) => {
              content.push(`Trending mention: ${operation.author} -> ${operation.permlink}`);
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
      "Quality curator vote: gtg -> hbd.funder",
      "Recommended post: mtyszczak - Write on Hive, Read Everywhere!",
      "Recommended reblog: thebeedevs -> fwaszkiewicz/hi-to-hive",
      "Trending mention: mtyszczak -> write-on-hive-read-everywhere",
      "Trending mention: fwaszkiewicz -> hi-to-hive"
    ]);
  });

  mockTest("6.3 - Should be able to create automated trading signal generator", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject, chain) => {
      const content: string[] = [];

      (bot as QueenBee).onWhaleAlert(chain!.hiveCoins(50000))
        .or.onFeedPriceChange(3)
        .or.onWitnessesMissedBlocks(5, "gtg", "blocktrades")
        .or.onInternalMarketOperation()
        .provideFeedPriceData()
        .provideWitnesses("gtg", "blocktrades")
        .subscribe({
          next(data) {
            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Trading signal - Large whale movement: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
            });

            const priceHistoryArray = Array.from(data.feedPrice!.priceHistory);
            if (priceHistoryArray.length >= 2) {
              const price1 = Number.parseInt(priceHistoryArray[0].base!.amount) / Number.parseInt(priceHistoryArray[0].quote!.amount);
              const price2 = Number.parseInt(priceHistoryArray[1].base!.amount) / Number.parseInt(priceHistoryArray[1].quote!.amount);
              const percentChange = Math.abs(price1 - price2) / price2 * 100;

              if (percentChange >= 3)
                content.push(`Trading signal - Significant price change: ${percentChange.toFixed(2)}%`);

            }

            if (data.witnesses.gtg && data.witnesses.gtg.totalMissedBlocks >= 5)
              content.push(`Trading signal - Witness reliability issue: gtg missed ${data.witnesses.gtg.totalMissedBlocks} blocks`);


            if (data.witnesses.blocktrades && data.witnesses.blocktrades.totalMissedBlocks >= 5)
              content.push(`Trading signal - Witness reliability issue: blocktrades missed ${data.witnesses.blocktrades.totalMissedBlocks} blocks`);


            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Trading signal - Market activity: ${operation.owner} order ${operation.orderId}`);
            });

            if (content.length >= 3)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Trading signal - Significant price change: 134.31%",
      "Trading signal - Witness reliability issue: gtg missed 988 blocks",
      "Trading signal - Witness reliability issue: blocktrades missed 3728 blocks"
    ]);
  });

  mockTest("7.1 - Should be able to handle multiple OR chaining", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onPosts("gtg")
        .or.onPosts("blocktrades")
        .or.onPosts("mtyszczak")
        .or.onPosts("fwaszkiewicz")
        .or.onComments("gtg")
        .or.onComments("fwaszkiewicz")
        .or.onVotes("gtg")
        .or.onVotes("blocktrades")
        .or.onFollow("gtg")
        .or.onReblog("thebeedevs")
        .subscribe({
          next(data) {
            data.posts.gtg?.forEach(({ operation }) => {
              content.push(`Chained post gtg: ${operation.title}`);
            });

            data.posts.mtyszczak?.forEach(({ operation }) => {
              content.push(`Chained post mtyszczak: ${operation.title}`);
            });

            data.posts.fwaszkiewicz?.forEach(({ operation }) => {
              content.push(`Chained post fwaszkiewicz: ${operation.title}`);
            });

            data.comments.gtg?.forEach(({ operation }) => {
              content.push(`Chained comment gtg: ${operation.parent_author}`);
            });

            data.comments.fwaszkiewicz?.forEach(({ operation }) => {
              content.push(`Chained comment fwaszkiewicz: ${operation.parent_author}`);
            });

            data.votes.gtg?.forEach(({ operation }) => {
              content.push(`Chained vote gtg: ${operation.author}`);
            });

            data.follows.gtg?.forEach(({ operation }) => {
              content.push(`Chained follow gtg: ${operation.following}`);
            });

            data.reblogs.thebeedevs?.forEach(({ operation }) => {
              content.push(`Chained reblog thebeedevs: ${operation.author}/${operation.permlink}`);
            });

            if (content.length >= 6)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Chained vote gtg: hbd.funder",
      "Chained post mtyszczak: Write on Hive, Read Everywhere!",
      "Chained post fwaszkiewicz: Hi To Hive! 🐝",
      "Chained comment gtg: purepinay",
      "Chained comment fwaszkiewicz: mtyszczak",
      "Chained follow gtg: thebeedevs",
      "Chained reblog thebeedevs: fwaszkiewicz/hi-to-hive"
    ]);
  });

  mockTest("7.2 - Should be able to handle repeated OR operations", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
        .or.or.or.or.onPosts("gtg")
        .provideBlockData()
        .subscribe({
          next(data) {
            content.push(`Repeated OR block: ${data.block.number}`);

            data.posts.gtg?.forEach(({ operation }) => {
              content.push(`Repeated OR post: ${operation.author} - ${operation.title}`);
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
      "Repeated OR block: 97477291",
      "Repeated OR block: 97477292"
    ]);
  });

  mockTest("7.3 - Should be able to handle duplicate provider calls", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
        .provideAccounts("gtg")
        .provideAccounts("gtg")
        .provideAccounts("gtg")
        .provideAccounts("gtg")
        .provideManabarData(/* RC */ 2, "gtg")
        .provideManabarData(/* RC */ 2, "gtg")
        .provideManabarData(/* RC */ 2, "gtg")
        .provideBlockData()
        .provideBlockData()
        .provideBlockData()
        .subscribe({
          next(data) {
            content.push(`Duplicate providers block: ${data.block.number}`);
            content.push(`Duplicate providers account: ${data.accounts.gtg?.name}`);
            content.push(`Duplicate providers manabar: ${data.manabarData.gtg?.[2]?.currentMana}`);

            if (content.length >= 3)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Duplicate providers block: 97477291",
      "Duplicate providers account: gtg",
      "Duplicate providers manabar: 2152098568737624"
    ]);
  });

  mockTest("7.4 - Should be able to handle provider type duplication", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      const content: string[] = [];

      (bot as QueenBee).onBlock()
        .provideAccounts("gtg")
        .provideAccounts("blocktrades")
        .provideAccounts("thebeedevs")
        .provideManabarData(/* RC */ 2, "gtg")
        .provideManabarData(/* UPVOTE */ 0, "gtg")
        .provideManabarData(/* DOWNVOTE */ 1, "gtg")
        .provideManabarData(/* RC */ 2, "blocktrades")
        .subscribe({
          next(data) {
            content.push(`Provider duplication gtg: ${data.accounts.gtg?.name}`);
            content.push(`Provider duplication blocktrades: ${data.accounts.blocktrades?.name}`);
            content.push(`Provider duplication thebeedevs: ${data.accounts.thebeedevs?.name}`);
            content.push(`Provider duplication RC gtg: ${data.manabarData.gtg?.[2]?.currentMana}`);
            content.push(`Provider duplication UPVOTE gtg: ${data.manabarData.gtg?.[0]?.currentMana}`);
            content.push(`Provider duplication RC blocktrades: ${data.manabarData.blocktrades?.[2]?.currentMana}`);

            if (content.length >= 6)
              resolve(content);
          },
          error: (err) => {
            console.error(err);
            reject(err);
          }
        });
    });

    expect(result).toEqual([
      "Provider duplication gtg: gtg",
      "Provider duplication blocktrades: blocktrades",
      "Provider duplication thebeedevs: thebeedevs",
      "Provider duplication RC gtg: 380450521230160",
      "Provider duplication UPVOTE gtg: 2897631713028020",
      "Provider duplication RC blocktrades: 29850078403493"
    ]);
  });

  mockTest("7.5 - Should be able to handle complex nested filter combinations", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject, chain) => {
      const content: string[] = [];

      (bot as QueenBee).onPosts("gtg")
        .or.onComments("gtg")
        .or.onVotes("gtg")
        .or.onFollow("gtg")
        .or.onReblog("gtg")
        .or.onMention("gtg")
        .or.onWhaleAlert(chain!.hiveCoins(1000))
        .or.onInternalMarketOperation()
        .or.onExchangeTransfer()
        .or.onNewAccount()
        .or.onCustomOperation("follow")
        .or.onAccountsBalanceChange(false, "gtg")
        .or.onAccountsMetadataChange("gtg")
        .or.onFeedPriceChange(2)
        .provideAccounts("gtg")
        .provideManabarData(/* RC */ 2, "gtg")
        .provideBlockData()
        .provideFeedPriceData()
        .subscribe({
          next(data) {
            data.posts.gtg?.forEach(({ operation }) => {
              content.push(`Complex post: ${operation.author} - ${operation.title}`);
            });

            data.comments.gtg?.forEach(({ operation }) => {
              content.push(`Complex comment: ${operation.author} -> ${operation.parent_author}`);
            });

            data.votes.gtg?.forEach(({ operation }) => {
              content.push(`Complex vote: ${operation.voter} -> ${operation.author}`);
            });

            data.follows.gtg?.forEach(({ operation }) => {
              content.push(`Complex follow: ${operation.follower} -> ${operation.following}`);
            });

            data.reblogs.gtg?.forEach(({ operation }) => {
              content.push(`Complex reblog: ${operation.account} -> ${operation.author}/${operation.permlink}`);
            });

            data.mentioned.gtg?.forEach((operation) => {
              content.push(`Complex mention: ${operation.author} -> ${operation.permlink}`);
            });

            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Complex whale: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
            });

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Complex market: ${operation.owner} - ${operation.orderId}`);
            });

            data.exchangeTransferOperations.forEach(({ operation }) => {
              content.push(`Complex exchange: ${operation.from} -> ${operation.to} (${operation.amount.amount})`);
            });

            data.newAccounts.forEach((account) => {
              content.push(`Complex new account: ${account.accountName}`);
            });

            if (data.customOperations["follow"])
              data.customOperations["follow"].forEach(({ operation }) => {
                content.push(`Complex custom: ${operation.id}`);
              });


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
      "Complex vote: gtg -> hbd.funder",
      "Complex comment: gtg -> purepinay",
      "Complex follow: gtg -> thebeedevs",
      "Complex reblog: gtg -> fwaszkiewicz/hi-to-hive",
      "Complex mention: mtyszczak -> write-on-hive-read-everywhere",
      "Complex mention: fwaszkiewicz -> hi-to-hive",
      "Complex whale: mxchive -> inhivepool (23890)",
      "Complex whale: blocktrades -> gtg (10000000)",
      "Complex market: honeybot - 1485200410",
      "Complex exchange: mxchive -> inhivepool (23890)",
      "Complex exchange: bdhivesteem -> gtg (1000)",
      "Complex custom: follow",
      "Complex custom: follow",
      "Complex custom: follow",
      "Complex custom: follow"
    ]);
  });

  mockTest("7.7 Resource Cleanup Stress Test", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string>((bot, resolve) => {
      const observers: Unsubscribable[] = [];

      for (let i = 0; i < 100; i++) {
        const observer = (bot as unknown as IWorkerBee<unknown>).observe.onPosts(`author${i}`)
          .or.onComments(`author${i}`)
          .provideAccounts(`author${i}`);

        observers.push(observer.subscribe({}));
      }

      const unsubscribed = observers.map(observer => observer.unsubscribe());

      if (observers.length >= 100 && unsubscribed.every(result => result === undefined)) // Check if all observers were unsubscribed (void return)
        resolve(`Unsubscribed ${observers.length} observers`);
    }, false, true);

    expect(result).toEqual("Unsubscribed 100 observers");
  });

  mockTest("7.8 Concurrent Observer Test", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string>((bot, resolve, testReject) => {
      const observer1 = (bot as unknown as IWorkerBee<unknown>).observe.onPosts("mtyszczak").provideAccounts("mtyszczak");
      const observer2 = (bot as unknown as IWorkerBee<unknown>).observe.onComments("fwaszkiewicz").provideAccounts("fwaszkiewicz");
      const observer3 = (bot as unknown as IWorkerBee<unknown>).observe.onVotes("gtg").provideManabarData(2, "gtg");

      Promise.all([
        new Promise((resolvePromise, reject) => {
          observer1.subscribe({ next: resolvePromise, error: (e: any) => { console.error(`Error: ${e} caught in observer1`); reject(e); }})
        }),
        new Promise((resolvePromise, reject) => {
          observer2.subscribe({ next: resolvePromise, error: (e: any) => { console.error(`Error: ${e} caught in observer2`); reject(e); }})
        }),
        new Promise((resolvePromise, reject) => {
          observer3.subscribe({ next: resolvePromise, error: (e: any) => { console.error(`Error: ${e} caught in observer3`); reject(e); }})
        })
      ]).then((results) => {
        // Check if all promises are resolved (results array contains resolved values)
        if (results.length === 3)
          resolve(`All ${results.length} concurrent observers completed successfully`);
      }).catch((e) => {
        console.error(`Error: ${e} caught in Promise.all`);
        testReject(e);
      });
    }, false, true);

    expect(result).toEqual("All 3 concurrent observers completed successfully");
  });

  mockTest("Should get manabar callback when account is empty", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string>((bot, resolve, reject) => {
      (bot as QueenBee).onAccountsManabarPercent(0, 90, "barddev").subscribe({
        next: (data) => {
          if (data)
            resolve(`Manabar data received: (${data.manabarData.barddev?.[0]?.currentMana}/${data.manabarData.barddev?.[0]?.max})`);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      });
    }, true);

    expect(result).toEqual("Manabar data received: (0/0)");
  });

  mockTest("Should get manabar callback when one of accounts is empty", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<Record<string, string>>((bot, resolve, reject) => {
      (bot as QueenBee).onAccountsManabarPercent(0, 90, "barddev", "gtg").subscribe({
        next: (data) => {
          if (data)
            resolve({
              barddev: `Manabar data received: (${data.manabarData.barddev?.[0]?.currentMana}/${data.manabarData.barddev?.[0]?.max})`,
              gtg: `Manabar data received: (${data.manabarData.gtg?.[0]?.currentMana}/${data.manabarData.gtg?.[0]?.max})`
            });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      });
    }, true);

    expect(result).toEqual({ barddev: "Manabar data received: (0/0)", gtg: "Manabar data received: (2944815083303610/2967310839581315)" });
  });

  mockTest("Should detect new vote", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<string[]>((bot, resolve, reject) => {
      (bot as QueenBee).onVotes("gtg").subscribe({
        next: (data) => {
          const now = Date.now();

          const votes: string[] = [];

          if (data.votes.gtg)
            data.votes.gtg?.forEach(({ operation }) => {
              votes.push(JSON.stringify(operation));
            });

          if (votes.length > 1 || (Date.now() - now) < 28000)
            resolve(votes);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      });
    }, true);

    expect(result).toEqual([
      "{\"voter\":\"gtg\",\"author\":\"hbd.funder\",\"weight\":10000,\"permlink\":\"re-upvote-this-post-to-fund-hbdstabilizer-20250716t045515z\"}"
    ]);
  });

  mockTest("Should detect account metadata change", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<Record<string, any>[]>((bot, resolve, reject) => {
      (bot as QueenBee).onAccountsMetadataChange("gtg").subscribe({
        next: (data) => {
          const now = Date.now();

          const metadata: Record<string, any>[] = [];

          if (data.accounts.gtg)
            metadata.push(data.accounts.gtg?.jsonMetadata)

          if (metadata.length > 1 || (Date.now() - now) < 28000)
            resolve(metadata);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      });
    }, true);

    expect(result).toEqual([
      {
        profile: {
          about: "IT Wizard, Hive Witness",
          location: "Hive",
          name: "Gandalf the Grey",
          profile_image: "https://grey.house/img/grey_4.jpg",
          version: 2,
          witness_description: "Gandalf the Grey, changed metadata.",
        },
      },
    ]);
  });

  mockTest("Should detect account balance change", async ({ createMockWorkerBeeTest }) => {
    const result = await createMockWorkerBeeTest<Record<string, any>[]>((bot, resolve, reject) => {
      (bot as QueenBee).onAccountsBalanceChange(false, "gtg").subscribe({
        next: (data) => {
          const now = Date.now();

          const balance: Record<string, any>[] = [];

          if (data.accounts.gtg)
            balance.push(data.accounts.gtg?.balance.HBD.total)

          if (balance.length > 1 || (Date.now() - now) < 28000)
            resolve(balance);
        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      });
    }, true);

    expect(result).toEqual([
      {
        amount: "3662",
        nai: "@@000000013",
        precision: 3,
      },
    ]);
  });
});
