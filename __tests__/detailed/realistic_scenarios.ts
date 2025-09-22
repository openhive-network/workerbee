/* eslint-disable no-console */
import { custom_json } from "@hiveio/wax";
import { expect } from "playwright/test";
import { test } from "../assets/jest-helper";

test.describe("Bot Realistic Scenarios", () => {
  test("1.1 - Should be able to monitor posts OR comments from multiple authors", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot.onPosts("mtyszczak").onPosts("nickdongsik").onComments("brando28").subscribe({
        next(data) {
          for (const author in data.posts)
            data.posts[author as keyof typeof data.posts]?.forEach(({ operation }) => content.push(`${operation.author} - ${operation.permlink}`));

          for (const author in data.comments)
            data.comments[author as keyof typeof data.comments]?.forEach(({ operation }) => content.push(`${operation.author} - ${operation.permlink}`));
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(content)
      });
    }, 96549390, 96549415, true);

    expect(result).toEqual([
      "brando28 - re-bitcoinman-ovjhawi6",
      "mtyszczak - hi-ve-everyone",
      "nickdongsik - yay-hb1hao"
    ]);
  });

  test("1.2 - Should be able to create social activity aggregator", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot.onVotes("e-sport-gamer").onFollow("fwaszkiewicz").onReblog("maxinpower").subscribe({
        next(data) {
          for (const author in data.votes)
            data.votes[author as keyof typeof data.votes]?.forEach(({ operation }) => {
              content.push(`Vote: ${operation.voter} - ${operation.permlink}`)
            });

          for (const author in data.follows)
            data.follows[author as keyof typeof data.follows]?.forEach(({ operation }) => {
              content.push(`Follow: ${operation.follower} - ${operation.following}`)
            });

          for (const author in data.reblogs)
            data.reblogs[author as keyof typeof data.reblogs]?.forEach(({ operation }) => {
              content.push(`Reblog: ${operation.author} - ${operation.permlink}`)
            });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(content)
      });
    }, 97146285, 97146300, true);

    expect(result).toEqual([
      "Vote: e-sport-gamer - city-pingeons",
      "Follow: fwaszkiewicz - thebeedevs",
      "Follow: fwaszkiewicz - thebeedevs",
      "Reblog: maxinpower - erinnnerungen-an-eine-gute-currywurst-berlin-impressions"
    ]);
  });

  test("1.3 - Should be able to create financial activity monitor", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject, chain) => {
      const content: string[] = [];

      bot
        .onWhaleAlert(chain!.hiveCoins(50))
        .onInternalMarketOperation()
        .onExchangeTransfer()
        .subscribe({
          next(data) {
            data.exchangeTransferOperations.forEach(({ operation }) => {
              content.push(`Exchange Transfer: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Internal Market Operation: ${operation.owner} - ${operation.orderId}`);
            });

            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Whale Alert: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97347575, 97347585, true);

    expect(result).toEqual([
      "Internal Market Operation: honeybot - 243293707",
      "Whale Alert: honey-swap -> luluwinda - 53308",
      "Internal Market Operation: honeybot - 1485200410",
      "Exchange Transfer: mxchive -> inhivepool - 23890"
    ]);
  });

  test("1.4 - Should be able to create content engagement tracker", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot.onMention("thebeedevs").onPosts("thebeedevs").onReblog("thebeedevs").subscribe({
        next(data) {
          data.posts.thebeedevs?.forEach(({ operation }) => {
            content.push(`Post: ${operation.author} - ${operation.permlink}`);
          });

          data.mentioned.thebeedevs?.forEach((operation) => {
            content.push(`Mention: ${operation.author} - ${operation.permlink}`);
          });

          data.reblogs.thebeedevs?.forEach(({ operation }) => {
            content.push(`Reblog: ${operation.author} - ${operation.permlink}`);
          });
        },
        error: (err) => {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(content)
      });
    }, 97639665, 97639695, true);

    expect(result).toEqual([
      "Post: thebeedevs - hivesense-why-nothing-worked-at-first-and-what-we-did-about-it",
      "Mention: thebeedevs - hivesense-why-nothing-worked-at-first-and-what-we-did-about-it",
      "Reblog: thebeedevs - hivesense-why-nothing-worked-at-first-and-what-we-did-about-it"
    ]);
  });

  test("1.5 - Should be able to create cross-platform activity monitor", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot
        .onCustomOperation("follow")
        .onCustomOperation("reblog")
        .onNewAccount().subscribe({
          next(data) {
            data.customOperations.follow?.forEach(({ operation }) => {
              content.push(`Follow: ${(operation as custom_json).json}`);
            });

            data.customOperations.reblog?.forEach(({ operation }) => {
              content.push(`Reblog: ${(operation as custom_json).json}`);
            });

            data.newAccounts.forEach((operation) => {
              content.push(`New Account: ${operation.accountName}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97664614, 97664618, true);

    expect(result).toEqual([
      "Follow: [\"reblog\",{\"account\":\"cribbio\",\"author\":\"donasycafe\",\"permlink\":\"feliz-4o-aniversario-mi-historia\"}]",
      "Follow: [\"reblog\",{\"account\":\"gasaeightyfive\",\"author\":\"donasycafe\",\"permlink\":\"feliz-4o-aniversario-mi-historia\"}]",
      "Reblog: [\"reblog\",{\"account\":\"dehai\",\"author\":\"rubenjr\",\"permlink\":\"hello-its-me-what-can-a-father-do\"}]",
      "New Account: ayasolene20"
    ]);
  });

  test("1.6 - Should be able to create content creator dashboard", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot
        .onPosts("thebeedevs")
        .onComments("thebeedevs")
        .onMention("thebeedevs")
        .onReblog("thebeedevs")
        .onVotes("thebeedevs")
        .subscribe({
          next(data) {
            data.posts.thebeedevs?.forEach(({ operation }) => {
              content.push(`Post: ${operation.author} - ${operation.permlink}`);
            });

            data.comments.thebeedevs?.forEach(({ operation }) => {
              content.push(`Comment: ${operation.author} - ${operation.permlink}`);
            });

            data.mentioned.thebeedevs?.forEach((operation) => {
              content.push(`Mention: ${operation.author} - ${operation.permlink}`);
            });

            data.reblogs.thebeedevs?.forEach(({ operation }) => {
              content.push(`Reblog: ${operation.author} - ${operation.permlink}`);
            });

            data.votes.thebeedevs?.forEach(({ operation }) => {
              content.push(`Vote: ${operation.voter} - ${operation.permlink}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97547200, 97547250, true);

    expect(result).toEqual([
      "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Mention: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Reblog: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots"
    ]);
  });

  test("1.7 - Should be able to create market movement detector", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject, chain) => {
      const content: string[] = [];

      bot
        .onWhaleAlert(chain!.hiveCoins(10000))
        .onInternalMarketOperation()
        .onExchangeTransfer()
        .subscribe({
          next(data) {
            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Whale Alert: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Internal Market Operation: ${operation.owner} - ${operation.orderId}`);
            });

            data.exchangeTransferOperations.forEach(({ operation }) => {
              content.push(`Exchange Transfer: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97347545, 97347555, true);

    expect(result).toEqual([
      "Whale Alert: huobi-pro -> huobi-withdrawal - 1598290",
      "Exchange Transfer: huobi-pro -> huobi-withdrawal - 1598290",
      "Whale Alert: aerrilee -> checkyzk - 2",
      "Internal Market Operation: daverick - 1751626472"
    ]);
  });

  test("2.1 - Should be able to create pattern analysis bot", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot
        .onVotes("thebeedevs")
        .onPosts("thebeedevs")
        .subscribe({
          next(data) {
            data.votes.thebeedevs?.forEach(({ operation }) => {
              content.push(`Vote: ${operation.voter} - ${operation.permlink}`);
            });

            data.posts.thebeedevs?.forEach(({ operation }) => {
              content.push(`Post: ${operation.author} - ${operation.permlink}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97547200, 97547250, true);

    expect(result).toEqual([
      "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots"
    ]);
  });

  test("2.2 - Should be able to create market trend analyzer", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject, chain) => {
      const content: string[] = [];

      bot
        .onWhaleAlert(chain!.hiveCoins(10000))
        .onInternalMarketOperation()
        .subscribe({
          next(data) {
            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Whale Alert: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Internal Market: ${operation.owner} - ${operation.orderId}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97347545, 97347555, true);

    expect(result).toEqual([
      "Whale Alert: huobi-pro -> huobi-withdrawal - 1598290",
      "Whale Alert: aerrilee -> checkyzk - 2",
      "Internal Market: daverick - 1751626472",
    ]);
  });

  test("2.3 - Should be able to create community growth monitor", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot
        .onNewAccount()
        .onFollow("thebeedevs")
        .onCustomOperation("follow")
        .subscribe({
          next(data) {
            data.newAccounts.forEach((operation) => {
              content.push(`New Account: ${operation.accountName}`);
            });

            data.follows.thebeedevs?.forEach(({ operation }) => {
              content.push(`Follow: ${operation.follower} -> ${operation.following}`);
            });

            data.customOperations.follow?.forEach(({ operation }) => {
              content.push(`Custom Follow: ${(operation as custom_json).json}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97664610, 97664620, true);

    expect(result).toEqual([
      "Custom Follow: [\"follow\",{\"follower\":\"dehai\",\"following\":\"rubenjr\",\"what\":[\"blog\"]}]",
      "Custom Follow: [\"follow\",{\"follower\":\"dehai\",\"following\":\"rubenjr\",\"what\":[]}]",
      "Custom Follow: [\"follow\",{\"follower\":\"dehai\",\"following\":\"rubenjr\",\"what\":[\"blog\"]}]",
      "Custom Follow: [\"reblog\",{\"account\":\"cribbio\",\"author\":\"donasycafe\",\"permlink\":\"feliz-4o-aniversario-mi-historia\"}]",
      "New Account: ayasolene20",
      "Custom Follow: [\"reblog\",{\"account\":\"gasaeightyfive\",\"author\":\"donasycafe\",\"permlink\":\"feliz-4o-aniversario-mi-historia\"}]"
    ]);
  });

  test("2.4 - Should be able to create content performance analyzer", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot
        .onPosts("thebeedevs")
        .onComments("thebeedevs")
        .onVotes("thebeedevs")
        .subscribe({
          next(data) {
            data.posts.thebeedevs?.forEach(({ operation }) => {
              content.push(`Post: ${operation.author} - ${operation.permlink}`);
            });

            data.comments.thebeedevs?.forEach(({ operation }) => {
              content.push(`Comment: ${operation.author} - ${operation.permlink}`);
            });

            data.votes.thebeedevs?.forEach(({ operation }) => {
              content.push(`Vote: ${operation.voter} - ${operation.permlink}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97547200, 97547250, true);

    expect(result).toEqual([
      "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots"
    ]);
  });

  test("2.5 - Should be able to create economic activity tracker", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject, chain) => {
      const content: string[] = [];

      bot
        .onWhaleAlert(chain!.hiveCoins(1000))
        .onExchangeTransfer()
        .onInternalMarketOperation()
        .subscribe({
          next(data) {
            data.whaleOperations.forEach(({ operation }) => {
              content.push(`Whale: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });

            data.exchangeTransferOperations.forEach(({ operation }) => {
              content.push(`Exchange: ${operation.from} -> ${operation.to} - ${operation.amount.amount}`);
            });

            data.internalMarketOperations.forEach(({ operation }) => {
              content.push(`Market: ${operation.owner} - ${operation.orderId}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97347575, 97347585, true);

    expect(result).toEqual([
      "Whale: honey-swap -> hive-engine - 403",
      "Whale: honey-swap -> luluwinda - 53308",
      "Market: honeybot - 243293707",
      "Market: honeybot - 1485200410",
      "Whale: mxchive -> inhivepool - 23890",
      "Exchange: mxchive -> inhivepool - 23890"
    ]);
  });

  test("2.6 - Should be able to create account behavior analysis", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const content: string[] = [];

      bot
        .onPosts("thebeedevs")
        .onVotes("thebeedevs")
        .onFollow("thebeedevs")
        .onReblog("thebeedevs")
        .subscribe({
          next(data) {
            data.posts.thebeedevs?.forEach(({ operation }) => {
              content.push(`Post: ${operation.author} - ${operation.permlink}`);
            });

            data.votes.thebeedevs?.forEach(({ operation }) => {
              content.push(`Vote: ${operation.voter} - ${operation.permlink}`);
            });

            data.follows.thebeedevs?.forEach(({ operation }) => {
              content.push(`Follow: ${operation.follower} -> ${operation.following}`);
            });

            data.reblogs.thebeedevs?.forEach(({ operation }) => {
              content.push(`Reblog: ${operation.author} - ${operation.permlink}`);
            });
          },
          error: (err) => {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(content)
        });
    }, 97547200, 97547250, true);

    expect(result).toEqual([
      "Post: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Vote: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots",
      "Reblog: thebeedevs - meet-workerbee-the-easy-way-to-build-smart-blockchain-bots"
    ]);
  });
});
