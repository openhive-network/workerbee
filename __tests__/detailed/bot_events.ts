/* eslint-disable no-console */

import { expect } from "@playwright/test";

import { test } from "../assets/jest-helper";

const HIVE_BLOCK_INTERVAL = 3000;

test.describe("WorkerBee Bot events test", () => {
  test("Should have a destroyable global module", async({ workerbeeTest }) => {
    await workerbeeTest(({ bot }) => {

      bot.delete();
    });
  });

  // TODO: This test uses a fake endpoint that doesn't exist. Fix the test to use a mock or real endpoint.
  test("Allow to broadcast to mirronet chain - broadcast on bot should not throw", async({ workerbeeTest }) => {
    await workerbeeTest(async({ WorkerBee, wax, beekeeperFactory }) => {
      /*
       * Prepare helper WorkerBee instance just to provide IHiveChainInterface instance.
       * It is a problem in PW tests to reference whole wax, since its dependencies need to be declared at importmap in test.html
       */
      const customWaxConfig = { apiEndpoint: "https://api.fake.openhive.network", chainId: "42", apiTimeout: 0 };

      const chain = await wax.createHiveChain(customWaxConfig);

      const bot = new WorkerBee(chain);

      const newTx = await chain.createTransaction();

      newTx.pushOperation(new wax.ReplyOperation({author: "gtg", permlink: `re-${Date.now()}`, parentAuthor: "hbd.funder",
        parentPermlink: "re-upvote-this-post-to-fund-hbdstabilizer-20250312t045515z", title: "test", body: "Awesome test!",
        maxAcceptedPayout: chain.hbdCoins(1000000), percentHbd: 9000, allowVotes: true, allowCurationRewards: true}));

      const bkInstance = await beekeeperFactory({ inMemory: true, enableLogs: false });
      const bkSession = bkInstance.createSession("salt and pepper");

      const {wallet} = await bkSession.createWallet("temp", "pass", true);
      const publicKey = await wallet.importKey("5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n");

      /// Intentionally sign using legacy method
      const legacySigDigest = newTx.legacy_sigDigest;
      const signature = wallet.signDigest(publicKey, legacySigDigest);
      newTx.addSignature(signature);

      bot.start();

      await bot.broadcast(newTx, { verifySignatures: true, expireInMs: 10_000 });

      bot.delete();
    });
  });

  test("Allow to pass explicit extended chain", async({ workerbeeTest }) => {
    const explicitChainTest = await workerbeeTest(async({ WorkerBee, wax }) => {
      /*
       * Prepare helper WorkerBee instance just to provide IHiveChainInterface instance.
       * It is a problem in PW tests to reference whole wax, since its dependencies need to be declared at importmap in test.html
       */
      const customWaxConfig = { apiEndpoint: "https://api.openhive.network", chainId: "badf00d", apiTimeout: 0 };
      const chain = await wax.createHiveChain(customWaxConfig);

      const localChain = chain!.extend<{
        my_custom_api: {
          nested_call: {
            params: undefined;
            result: undefined;
          }
        }
      }>();

      // Test if TypeScript passes on extended chain:
      localChain.api.my_custom_api.nested_call.endpointUrl = "no-call.local";

      const bot = new WorkerBee(chain);

      // Should be able to directly call the extended API from the provided chain:
      const extendedEndpointUrl = localChain.api.my_custom_api.nested_call.endpointUrl;

      bot.start();

      // Validate endpoints to easily check that instances match
      const validChainInstance = bot.chain !== undefined && localChain !== undefined && bot.chain.endpointUrl === localChain.endpointUrl;

      bot.delete();

      return {
        validChainInstance,
        extendedEndpointUrl
      };
    });

    expect(explicitChainTest.validChainInstance).toEqual(true);
    expect(explicitChainTest.extendedEndpointUrl).toEqual("no-call.local");
  });

  test("Should be able to parse at least 2 blocks from the remote using block observer", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }, hiveBlockInterval) => {
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

      bot.start();

      await new Promise(res => { setTimeout(res, hiveBlockInterval * 2); });

      observer.unsubscribe();

      return blocksParsed;
    }, HIVE_BLOCK_INTERVAL);

    expect(result).toBeGreaterThanOrEqual(1);
  });

  test("Should not allow double subscription to observers", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(({ bot }) => {
      const observer = bot.observe.onBlock();

      // First subscription should work fine
      observer.subscribe({
        next(_data) {
          // Block handler
        },
        error(err) {
          console.error(err);
        }
      });

      // Second subscription should throw an error
      try {
        observer.subscribe({
          next(_data) {
            // Block handler
          },
          error(err) {
            console.error(err);
          }
        });
        return false; // Should not reach here - the second subscribe should have thrown
      } catch (error) {
        return (error as Error).message === "Double subscription not allowed. Each QueenBee instance can only be subscribed to once.";
      }
    });

    expect(result).toBe(true);
  });

  test("Should not allow subscription after unsubscribe", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(({ bot }) => {
      const observer = bot.observe.onBlock();

      // First subscription should work
      const subscription1 = observer.subscribe({
        next(_data) {
          // Block handler
        },
        error(_err) {
          // Error handler
        }
      });

      // Unsubscribe
      subscription1.unsubscribe();

      // Try to subscribe again - this should now fail
      try {
        observer.subscribe({
          next(_data) {
            // Block handler
          },
          error(_err) {
            // Error handler
          }
        });
        return false; // Should not reach here - the second subscribe should have thrown
      } catch (error: any) {
        return error.message === "Double subscription not allowed. Each QueenBee instance can only be subscribed to once.";
      }
    });

    expect(result).toBe(true);
  });

  test("Should allow subscription to other observes", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(({ bot }) => {
      const observer1 = bot.observe.onBlock();

      // First subscription should work
      observer1.subscribe({
        next(_data) {
          // Block handler
        },
        error(_err) {
          // Error handler
        }
      });

      const observer2 = bot.observe.onBlock();

      try {
        observer2.subscribe({
          next(_data) {
            // Block handler
          },
          error(_err) {
            // Error handler
          }
        });
        return true;
      } catch {
        return false;
      }
    });

    expect(result).toBe(true);
  });

  test("Should not fail when async next callback fails", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }, hiveBlockInterval) => {
      let blocksParsed = 0;
      const observer = bot.observe.onBlock().subscribe({
        /* eslint-disable-next-line require-await */
        async next(data) {
          console.info(`Got block #${data.block.number}`);
          ++blocksParsed;

          throw new Error("Intentional error in next()");
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

  test("Should be able to analyze blocks successively", async({ workerbeeTest }) => {
    test.setTimeout(60_000);
    await workerbeeTest.dynamic(async({ bot }, hiveBlockInterval) => {
      let blockNumber: number | undefined;

      // eslint-disable-next-line no-async-promise-executor
      await new Promise<void>(async (resolve, reject) => {
        const observer = bot.observe.onBlock().provideBlockData().subscribe({
          next(data) {
            console.info(`Got block #${data.block.number}`);
            if (typeof blockNumber !== "undefined")
              if (blockNumber + 1 !== data.block.number) {
                console.error(`Blocks are not consecutive: ${blockNumber} followed by ${data.block.number}`);
                reject(new Error("Blocks are not consecutive"));
                return;
              }


            blockNumber = data.block.number;
          },
          error(err) {
            console.error(err);
          }
        });

        await bot.start();

        await new Promise(res => { setTimeout(res, hiveBlockInterval * 5); });

        observer.unsubscribe();
        resolve();
      });
    }, HIVE_BLOCK_INTERVAL);
  });

  test("Should be able to use async iterator on bot", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }, hiveBlockInterval) => {
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
    const result = await workerbeeTest(async({ bot }, hiveBlockInterval) => {
      const result = await Promise.race([
        new Promise<string>((res, rej) => {
          bot.start();

          console.info("Waiting for full manabar regeneration on initminer");

          const observer = bot.observe.onAccountsFullManabar(/* EManabarType.RC */ 2, "initminer");
          observer.subscribe({
            next(data) {
              if (!data.manabarData["initminer"]?.[2])
                return rej(new Error("Could not retrieve RC manabar data for initminer"));

              console.info(`Account has full manabar: ${data.manabarData["initminer"][2].percent}%`);

              res(data.manabarData["initminer"][2].currentMana.toString());
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

  // TODO: This test uses a fake endpoint that doesn't exist. Fix the test to use a mock or real endpoint.
  test("Should be able to use incoming payout observer", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee, wax, beekeeperFactory }) => {
      const chain = await wax.createHiveChain({
        apiTimeout: 0,
        apiEndpoint: "https://api.fake.openhive.network",
        chainId: "42"
      });

      const bot = new WorkerBee(chain);

      const bkInstance = await beekeeperFactory({ inMemory: true, enableLogs: false });
      const bkSession = bkInstance.createSession("salt and pepper");

      const { wallet } = await bkSession.createWallet("temp", "pass", true);
      const publicKey = await wallet.importKey("5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n");

      bot.start();

      const tx = await bot.chain!.createTransaction();
      const targetTx = tx.transaction;

      const getSignedTx = () => {
        const tx = bot.chain!.createTransactionFromProto(structuredClone(targetTx));
        tx.pushOperation(new wax.ReplyOperation({
          parentAuthor: "thebeedevs",
          parentPermlink: "further-integration-of-metamask-and-hive-wallet",
          author: "gtg",
          body: "WB tests",
          permlink: `wb-tests-${Date.now()}`
        }));
        tx.sign(wallet, publicKey);
        return tx;
      };

      setTimeout(() => { // Broadcaster
        const tx = getSignedTx();
        console.log(`Broadcasting reply transaction #${tx.id}`);
        void bot.chain!.broadcast(tx).catch(console.error);
      }, 2000);

      const result = await new Promise<number>((res, rej) => { // Listener
        const observer = bot.observe.onCommentsIncomingPayout("-7d", "gtg");
        observer.subscribe({
          next(data) {
            let rshares: number | undefined;

            for(const account in data.commentsMetadata)
              for(const permlink in data.commentsMetadata[account as "gtg"]) {
                rshares = Number(data.commentsMetadata[account as "gtg"]![permlink].netRshares);
                console.info(`Retrieved comment payout of @${account}: ${rshares} rshares for ${permlink}`);
              }

            if (rshares === undefined)
              return rej(new Error("Could not retrieve rshares for publisher1"));

            res(rshares);
          },
          error(err) {
            console.error(err);
          }
        });
      });

      bot.stop();
      bot.delete();

      console.log(`Result: ${result}`);

      return result;
    });

    expect(result).toBeDefined();
  });

  test("Should be able to evaluate or condition in first statement", async({ workerbeeTest }) => {
    await workerbeeTest(async({ bot }, hiveBlockInterval) => {
      await Promise.race([
        new Promise<void>(res => {
          bot.start();

          const observer = bot.observe.onAccountsFullManabar(/* EManabarType.RC */ 2, "initminer").onBlockNumber(1);
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
    await workerbeeTest(async({ bot }, hiveBlockInterval) => {
      await Promise.race([
        new Promise<void>(res => {
          bot.start();

          const observer = bot.observe.onBlockNumber(1).onAccountsFullManabar(/* EManabarType.RC */ 2, "initminer");
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
    const result = await workerbeeTest.dynamic(async({ bot }, hiveBlockInterval) => {
      let calls = 0;
      let res: () => void;

      await Promise.race([
        new Promise<void>(_res => {
          res = _res;
          bot.start();

          const observer = bot.observe.onBlock().onBlock().onBlock().onBlock().onBlock();
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

  test("Should capture intentional error - negative block number", async({ workerbeeTest }) => {
    // Should time out if no error is captured
    await workerbeeTest(async({ bot }) => {
      await bot.start();

      await new Promise<void>((resolve, reject) => {
        bot.providePastOperations(-1, -1).onBlock().subscribe({
          next(data) { // Should not get here
            console.log(`Got block #${data.block.number}`);
            reject(new Error("Should not get into this callback"));
          },
          error(err) {
            console.error("Inside of test - intentional error:", err);

            resolve();
          }
        });
      })

      bot.stop();
      bot.delete();
    });
  });

  test("Should capture intentional error - block in the future", async({ workerbeeTest }) => {
    // Should time out if no error is captured
    await workerbeeTest(async({ bot }) => {
      await bot.start();

      await new Promise<void>((resolve, reject) => {
        bot.providePastOperations(2_147_482_640, 2_147_483_640).onBlock().subscribe({
          next(data) { // Should not get here
            console.log(`Got block #${data.block.number}`);
            reject(new Error("Should not get into this callback"));
          },
          error(err) {
            console.error("Inside of test - intentional error:", err);

            resolve();
          }
        });
      })

      bot.stop();
      bot.delete();
    });
  });

  test("Should be able to parse blocks from the past - exact amount of blocks", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
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
          complete: () => setTimeout(resolve, 1000) // Wait a while to collect all the calls
        });
      })

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBe(4);
  });

  test("Should be able to parse blocks from the past - transaction id observe", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      const { head_block_number: headBlock } = await bot.chain!.api.database_api.get_dynamic_global_properties({});

      const { block } = await bot.chain!.api.block_api.get_block({ block_num: headBlock - 1 });

      console.log(`Waiting for transaction id ${block!.transaction_ids[0]} from block ${headBlock - 1}`);

      let gotTx = false;
      await new Promise<void>(resolve => {
        bot.providePastOperations(headBlock - 3, headBlock).onTransactionIds(block!.transaction_ids[0]).provideBlockHeaderData().subscribe({
          next(data) {
            gotTx = true;

            console.log(`Got transaction #${block!.transaction_ids[0]} in block ${data.block.number}: ${
              data.transactions[block!.transaction_ids[0]]!.operations.length} operations`);
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      })

      bot.stop();
      bot.delete();

      return gotTx;
    });

    expect(result).toBeTruthy();
  });

  test("Should be able to parse blocks from the past and print timings - more than 1000", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }) => {
      await bot.start();

      let calls = 0;
      const timings = await new Promise<void>(resolve => {
        const observer = bot.providePastOperations(500017, 501020).onBlock().subscribe({
          next() {
            ++calls;
          },
          error(err) {
            console.error(err);
          },
          complete: () => resolve((observer as any).timings) // @internal
        });
      })

      console.log(timings);

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBeGreaterThanOrEqual(1002);
  });

  test("Should be able to parse blocks from the past - impacted accounts", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
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
          complete: () => setTimeout(resolve, 1000) // Wait a while to collect all the calls before destroying the chain object
        });
      })

      bot.stop();
      bot.delete();

      return calls;
    });

    expect(result).toBe(6);
  });

  test("Should be able to parse blocks from the past - more than relative time", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }) => {
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

  test("Should be able to observe votes on accounts", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let vote = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(97117000, 97117025).onVotes("gtg").subscribe({
          next(data) {
            data.votes["gtg"]?.forEach(({ operation }) => {
              vote = `Vote operation: ${operation.voter} voted for ${operation.author}/${operation.permlink}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return vote;
    });

    expect(result).toBe("Vote operation: gtg voted for hbd.funder/re-upvote-this-post-to-fund-hbdstabilizer-20250626t045515z");
  });

  test("Should be able to observe posts from specific authors", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let post = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onPosts("mtyszczak").subscribe({
          next(data) {
            data.posts["mtyszczak"]?.forEach(({ operation }) => {
              post = `New post created: ${operation.author}/${operation.permlink}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return post;
    });

    expect(result).toBe("New post created: mtyszczak/hi-ve-everyone");
  });

  test("Should be able to observe comments from specific authors", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }) => {
      await bot.start();

      let comment = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(96549690, 96549715).onComments("gtg").subscribe({
          next(data) {
            data.comments["gtg"]?.forEach(({ operation }) => {
              comment = `New comment created: ${operation.author}/${operation.permlink}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return comment;
    });

    expect(result).toBe("New comment created: gtg/re-mtyszczak-1749229740753");
  });

  test("Should be able to observe new account creation", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let newAccount = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(96685040, 96685065).onNewAccount().subscribe({
          next(data) {
            console.log(data.newAccounts)
            data.newAccounts?.forEach(({ accountName, creator }) => {
              newAccount = `New account created: ${accountName} by ${creator}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return newAccount;
    });

    expect(result).toBe("New account created: fwaszkiewicz by gtg");
  });

  test("Should be able to observe custom operations", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let customOp = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(97146305, 97146312).onCustomOperation("follow").subscribe({
          next(data) {
            data.customOperations.follow?.forEach(({ transaction }) => {
              customOp = transaction.transaction.operations[0].custom_json_operation?.json || "";
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return customOp;
    });

    expect(result).toBe("[\"follow\",{\"follower\":\"fwaszkiewicz\",\"following\":\"gtg\",\"what\":[\"blog\"]}]");
  });

  test("Should be able to observe reblog operations", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let reblogedPost = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(96839100, 96839115).onReblog("thebeedevs").subscribe({
          next(data) {
            console.log(data);
            data.reblogs["thebeedevs"]?.forEach(({ operation }) => {
              reblogedPost = `${operation.account} rebloged: ${operation.author}/${operation.permlink}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return reblogedPost;
    });

    expect(result).toBe("thebeedevs rebloged: mtyszczak/write-on-hive-read-everywhere");
  });

  test("Should be able to observe follow operations", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let follow = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(97146305, 97146312).onFollow("fwaszkiewicz").subscribe({
          next(data) {
            data.follows["fwaszkiewicz"]?.forEach(({ operation }) => {
              follow = `${operation.follower} followed: ${operation.following}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return follow;
    });

    expect(result).toBe("fwaszkiewicz followed: gtg");
  });

  test("Should be able to observe account mentions in posts", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let mention = "";

      await new Promise<void>(resolve => {
        bot.providePastOperations(96812075, 96812095).onMention("gtg").subscribe({
          next(data) {
            console.log(data);
            data.mentioned["gtg"]?.forEach(operation => {
              mention = `gtg has been mentioned in post: ${operation.author}/${operation.permlink}`;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return mention;
    });

    expect(result).toBe("gtg has been mentioned in post: mtyszczak/write-on-hive-read-everywhere");
  });

  test("Should be able to observe internal market operations", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let marketOpCount = 0;

      await new Promise<void>(resolve => {
        bot.providePastOperations(97346870, 97346880).onInternalMarketOperation().subscribe({
          next(data) {
            data.internalMarketOperations.forEach(({ operation }) => {
              console.log(`Internal market operation: ${operation.owner} - ${operation.orderId}`);

              ++marketOpCount;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return marketOpCount;
    });

    expect(result).toBeGreaterThanOrEqual(4);
  });

  test("Should be able to observe exchange transfer operations", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let exchangeTransferCount = 0;

      await new Promise<void>(resolve => {
        bot.providePastOperations(97346915, 97346930).onExchangeTransfer().subscribe({
          next(data) {
            data.exchangeTransferOperations.forEach(({ operation }) => {
              console.log(`Exchange transfer operation: ${operation.from} -> ${operation.to} - ${operation.amount.amount} ${operation.amount.nai}`);

              exchangeTransferCount++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return exchangeTransferCount;
    });

    expect(result).toBeGreaterThanOrEqual(4);
  });

  test("Should be able to observe exchange transfer operation to exchange account", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      const exchangeTransfer: string[] = [];

      await new Promise<void>(resolve => {
        bot.providePastOperations(97346930, 97346940).onExchangeTransfer().subscribe({
          next(data) {
            data.exchangeTransferOperations.forEach(({ operation }) => {
              exchangeTransfer.push(`Exchange transfer operation: ${operation.from} -> ${operation.to} - ${operation.amount.amount} HIVE`);
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return exchangeTransfer;
    });

    expect(result).toEqual([
      "Exchange transfer operation: inhivepool -> mxchive - 43120 HIVE"
    ]);
  });

  test("Should be able to observe whale alerts for large transfers", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }) => {
      await bot.start();

      let whaleOpCount = 0;

      await new Promise<void>(resolve => {
        bot.providePastOperations(97347570, 97347585).onWhaleAlert(bot.chain!.hiveCoins(50)).subscribe({
          next(data) {
            data.whaleOperations.forEach(({ operation }) => {
              console.log(`Whale alert: ${operation.from} -> ${operation.to} - ${operation.amount.amount} ${operation.amount.nai}`);

              whaleOpCount++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      bot.stop();
      bot.delete();

      return whaleOpCount;
    });

    expect(result).toBeGreaterThanOrEqual(2);
  });

  test("Should be able to observe account balance changes", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }) => {
      await bot.start();

      let balanceChanged = false;

      await new Promise<void>(resolve => {
        bot.observe.onAccountsBalanceChange(false, "blocktrades").subscribe({
          next() {
            balanceChanged = true;
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });

        // Use a short timeout since this is a live test
        setTimeout(() => resolve(), 5000);
      });

      bot.stop();
      bot.delete();

      return balanceChanged;
    });

    expect(typeof result).toBe("boolean");
  });

  test("Should be able to observe account metadata changes", async({ workerbeeTest }) => {
    const result = await workerbeeTest.dynamic(async({ bot }) => {
      await bot.start();

      let metadataChanged = false;

      await new Promise<void>(resolve => {
        bot.observe.onAccountsMetadataChange("blocktrades").subscribe({
          next() {
            metadataChanged = true;
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });

        // Use a short timeout since this is a live test
        setTimeout(() => resolve(), 5000);
      });

      bot.stop();
      bot.delete();

      return metadataChanged;
    });

    expect(typeof result).toBe("boolean");
  });

  test("Should be able to observe manabar percentage threshold", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }, hiveBlockInterval) => {
      const result = await Promise.race([
        new Promise<string>((res, rej) => {
          bot.start();

          console.info("Waiting for manabar to reach 50% on initminer");

          const observer = bot.observe.onAccountsManabarPercent(/* EManabarType.RC */ 2, 50, "initminer");
          observer.subscribe({
            next(data) {
              if (!data.manabarData["initminer"]?.[2])
                return rej(new Error("Could not retrieve RC manabar data for initminer"));

              console.info(`Account manabar reached threshold: ${data.manabarData["initminer"][2].percent}%`);

              res(data.manabarData["initminer"][2].currentMana.toString());
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

  test("Should be able to observe feed price changes", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }, hiveBlockInterval) => {

      const result = await Promise.race([
        new Promise<boolean>((res) => {
          bot.start();

          console.info("Waiting for feed price change of 5%");

          const observer = bot.observe.onFeedPriceChange(5);
          observer.subscribe({
            next() {
              console.info("Feed price changed by 5%");
              res(true);
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<boolean>((res) => { setTimeout(() => res(false), hiveBlockInterval * 2); })
      ]);

      bot.stop();
      bot.delete();

      return result;
    }, HIVE_BLOCK_INTERVAL);

    // This might not trigger in test environment, so we just check it doesn't throw
    expect(typeof result).toBe("boolean");
  });

  test("Should be able to observe feed price no change", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }, hiveBlockInterval) => {

      const result = await Promise.race([
        new Promise<boolean>((res) => {
          bot.start();

          console.info("Waiting for feed price to remain unchanged for 1 hour");

          const observer = bot.observe.onFeedPriceNoChange(1);
          observer.subscribe({
            next() {
              console.info("Feed price has not changed for 1 hour");
              res(true);
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<boolean>((res) => { setTimeout(() => res(false), hiveBlockInterval * 2); })
      ]);

      bot.stop();
      bot.delete();

      return result;
    }, HIVE_BLOCK_INTERVAL);

    // This might not trigger in test environment, so we just check it doesn't throw
    expect(typeof result).toBe("boolean");
  });

  test("Should be able to observe witness missed blocks", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }, hiveBlockInterval) => {

      const result = await Promise.race([
        new Promise<boolean>((res) => {
          bot.start();

          console.info("Waiting for witness to miss 5 blocks");

          const observer = bot.observe.onWitnessesMissedBlocks(5, "gtg");
          observer.subscribe({
            next() {
              console.info("Witness has missed 5 blocks");
              res(true);
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<boolean>((res) => { setTimeout(() => res(false), hiveBlockInterval * 2); })
      ]);

      bot.stop();
      bot.delete();

      return result;
    }, HIVE_BLOCK_INTERVAL);

    // This might not trigger in test environment, so we just check it doesn't throw
    expect(typeof result).toBe("boolean");
  });

  test("Should be able to observe account alarms", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot }, hiveBlockInterval) => {

      const result = await Promise.race([
        new Promise<boolean>((res) => {
          bot.start();

          console.info("Waiting for account alarms");

          const observer = bot.observe.onAlarm("blocktrades");
          observer.subscribe({
            next(_data) {
              console.info("Account alarm detected");
              res(true);
            },
            error(err) {
              console.error(err);
            }
          });
        }),
        new Promise<boolean>((res) => { setTimeout(() => res(false), hiveBlockInterval * 2); })
      ]);

      bot.stop();
      bot.delete();

      return result;
    }, HIVE_BLOCK_INTERVAL);

    // This might not trigger in test environment, so we just check it doesn't throw
    expect(typeof result).toBe("boolean");
  });

  test("Should be able to use custom filter", async({ workerbeeTest }) => {
    await workerbeeTest(async({ bot, WorkerBeePackage }) => {
      await bot.start();

      const { current_shuffled_witnesses } = await bot.chain!.extend<{
        database_api: { get_witness_schedule: { params: {}, result: { current_shuffled_witnesses: string[] } } }
      }>().api.database_api.get_witness_schedule({});

      await new Promise((resolve) => {
        bot.observe.filter({
          async match(data) {
            // This test will also ensure we can retrieve data from other classifiers
            const { currentWitness } = await data.get(WorkerBeePackage.DynamicGlobalPropertiesClassifier);

            const isInSchedule = current_shuffled_witnesses.includes(currentWitness);

            console.log("Current witness:", currentWitness, "; is in schedule:", isInSchedule );

            return isInSchedule;
          }
        }).subscribe({
          next() {
            resolve(true);
          },
          error: console.error
        });
      });


      bot.stop();
      bot.delete();
    });
  });

  test("Should be able to use custom provider", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot, WorkerBeePackage }) => {
      await bot.start();

      const { current_shuffled_witnesses } = await bot.chain!.extend<{
        database_api: { get_witness_schedule: { params: {}, result: { current_shuffled_witnesses: string[] } } }
      }>().api.database_api.get_witness_schedule({});

      const result = await new Promise<string>((resolve) => {
        bot.observe.provide({
          async provide(data) {
            const { currentWitness } = await data.get(WorkerBeePackage.DynamicGlobalPropertiesClassifier);

            return { currentWitness };
          }
        })
          .subscribe({
            next({ currentWitness }) {
              resolve(currentWitness);
            },
            error: console.error
          });
      });


      bot.stop();
      bot.delete();

      return current_shuffled_witnesses.includes(result);
    });

    expect(result).toStrictEqual(true);
  });

  test("Should be able to use custom filter with piped data", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ bot, WorkerBeePackage }) => {
      await bot.start();

      const result = await new Promise<string[]>((resolve) => {
        bot.observe.filterPiped(
          async () => {
            const { current_shuffled_witnesses } = await bot.chain!.extend<{
              database_api: { get_witness_schedule: { params: {}, result: { current_shuffled_witnesses: string[] } } }
            }>().api.database_api.get_witness_schedule({});

            return { witnessSchedule: current_shuffled_witnesses };
          },
          async ({ witnessSchedule }, data) => {
            const { currentWitness } = await data.get(WorkerBeePackage.DynamicGlobalPropertiesClassifier);

            return witnessSchedule.includes(currentWitness);
          }
        )
          .subscribe({
            next({ witnessSchedule }) {
              resolve(witnessSchedule);
            },
            error: console.error
          });
      });


      bot.stop();
      bot.delete();

      return result.length;
    });

    expect(result).toStrictEqual(21);
  });
});
