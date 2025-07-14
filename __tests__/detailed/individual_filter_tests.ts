/* eslint-disable no-console */
import { expect } from "@playwright/test";
import { test } from "../assets/jest-helper";

test.describe("WorkerBee Individual Filter Verification", () => {
  test("1.1 - Should trigger when any specified account creates post - multiple accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: string[] = [];

      bot.providePastOperations(96549390, 96549415).onPosts("mtyszczak", "author2", "author3").subscribe({
        next(data) {
          for (const author of ["mtyszczak", "author2", "author3"])
            data.posts[author]?.forEach(({ operation }) => {
              capturedPosts.push(`Post by ${operation.author}: ${operation.permlink}`);
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedPosts)
      });
    });

    expect(result).toEqual(["Post by mtyszczak: hi-ve-everyone"]);
  });

  test("1.1 - Should trigger for simultaneous posts from multiple accounts in same block", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: Array<{ author: string; blockNumber: number }> = [];

      bot.providePastOperations(97632050, 97632075).onBlock().or.onPosts("comandoyeya", "daddydog").subscribe({
        next(data) {
          for (const author of ["comandoyeya", "daddydog"])
            data.posts[author]?.forEach(({ operation }) => {
              capturedPosts.push({
                author: operation.author,
                blockNumber: data.block.number
              });
            });

        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedPosts)
      });
    });

    expect(result).toEqual([
      {
        author: "comandoyeya",
        blockNumber: 97632067
      },
      {
        author: "daddydog",
        blockNumber: 97632067
      }
    ]);
  });

  test("1.2 - Should NOT trigger when account creates comment instead of post", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let postsDetected = 0;
      let commentsDetected = 0;

      await new Promise<void>(resolve => {
        // Monitor an account known to create comments in this range
        bot.providePastOperations(96549690, 96549715).onPosts("gtg").subscribe({
          next(data) {
            // Count posts (should be 0)
            data.posts["gtg"]?.forEach(() => {
              postsDetected++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Also check for comments in the same range to verify account was active
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549690, 96549715).onComments("gtg").subscribe({
          next(data) {
            data.comments["gtg"]?.forEach(() => {
              commentsDetected++;
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

      return { postsDetected, commentsDetected };
    });

    // Should detect comments but NOT posts
    expect(result.commentsDetected).toBeGreaterThan(0);
    expect(result.postsDetected).toBe(0);
  });

  test("1.2 - Should NOT trigger when monitored accounts create comments instead of posts", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      const postResults: Record<string, number> = {};
      const commentResults: Record<string, number> = {};

      // Test accounts known to comment in this range
      const testAccounts = ["gtg", "moretea", "khantaimur"];

      await new Promise<void>(resolve => {
        // Monitor multiple accounts for posts (should not trigger for comment activity)
        bot.providePastOperations(96549690, 96549715).onPosts(...testAccounts).subscribe({
          next(data) {
            testAccounts.forEach(account => {
              data.posts[account]?.forEach(() => {
                postResults[account] = (postResults[account] || 0) + 1;
              });
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Verify these accounts were active with comments
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549690, 96549715).onComments(...testAccounts).subscribe({
          next(data) {
            testAccounts.forEach(account => {
              data.comments[account]?.forEach(() => {
                commentResults[account] = (commentResults[account] || 0) + 1;
              });
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

      return { postResults, commentResults };
    });

    const totalComments = Object.values(result.commentResults).reduce((sum, count) => sum + count, 0);
    const totalPosts = Object.values(result.postResults).reduce((sum, count) => sum + count, 0);

    expect(totalComments).toBeGreaterThan(0);
    expect(totalPosts).toBe(0);
  });

  test("1.2 - Should NOT trigger when different account creates post", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let monitoredAccountPosts = 0;
      let otherAccountPosts = 0;

      // Monitor for posts from a specific account
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onPosts("nonexistent-account").subscribe({
          next(data) {
            data.posts["nonexistent-account"]?.forEach(() => {
              monitoredAccountPosts++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Verify other accounts were posting in this range
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onPosts("mtyszczak").subscribe({
          next(data) {
            data.posts["mtyszczak"]?.forEach(() => {
              otherAccountPosts++;
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

      return { monitoredAccountPosts, otherAccountPosts };
    });

    // Should NOT detect posts from monitored account, but should detect from other account
    expect(result.monitoredAccountPosts).toBe(0);
    expect(result.otherAccountPosts).toBeGreaterThan(0);
  });

  test("1.2 - Should handle empty account list", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<boolean>((bot, resolve, reject) => {
      let dataReceived = false;

      try {
        // Test with no accounts (edge case)
        bot.providePastOperations(96549390, 96549415).onPosts().subscribe({
          next(_data) {
            dataReceived = true;
            console.log("Data received for empty account list");
          },
          error(err) {
            console.error("Error with empty account list:", err);
            reject(err);
          },
          complete: () => resolve(dataReceived)
        });
      } catch {
        reject(new Error("Unexpected error occurred"));
      }
    });

    expect(result).toBeFalsy();
  });

  test("2.1 - Should trigger when any specified account creates comment - multiple accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedComments: string[] = [];

      bot.providePastOperations(96549690, 96549715).onComments("gtg", "moretea", "khantaimur").subscribe({
        next(data) {
          for (const author of ["gtg", "moretea", "khantaimur"])
            data.comments[author]?.forEach(({ operation }) => {
              capturedComments.push(`Comment by ${operation.author}: ${operation.permlink}`);
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedComments)
      });
    });

    expect(result).toEqual([
      "Comment by moretea: re-leothreads-2xpn8nyzd",
      "Comment by khantaimur: re-vkcmjbdble",
      "Comment by gtg: re-mtyszczak-1749229740753"
    ]);
  });

  test("2.1 - Should trigger for simultaneous comments from multiple accounts in same block", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedComments: Array<{ author: string; blockNumber: number }> = [];

      bot.providePastOperations(97634334, 97634348).onBlock().or.onComments("zayyar99", "beckyroyal").subscribe({
        next(data) {
          for (const author of ["zayyar99", "beckyroyal"])
            data.comments[author]?.forEach(({ operation }) => {
              capturedComments.push({
                author: operation.author,
                blockNumber: data.block.number
              });
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedComments)
      });
    });

    expect(result).toEqual([
      {
        author: "zayyar99",
        blockNumber: 97634338
      },
      {
        author: "beckyroyal",
        blockNumber: 97634338
      }
    ]);
  });

  test("2.2 - Should NOT trigger when account creates post instead of comment", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let commentsDetected = 0;
      let postsDetected = 0;

      await new Promise<void>(resolve => {
        // Monitor an account known to create posts in this range for comments (should not trigger)
        bot.providePastOperations(96549390, 96549415).onComments("mtyszczak").subscribe({
          next(data) {
            // Count comments (should be 0)
            data.comments["mtyszczak"]?.forEach(() => {
              commentsDetected++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Also check for posts in the same range to verify account was active with posts
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onPosts("mtyszczak").subscribe({
          next(data) {
            data.posts["mtyszczak"]?.forEach(() => {
              postsDetected++;
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

      return { commentsDetected, postsDetected };
    });

    // Should detect posts but NOT comments
    expect(result.postsDetected).toBeGreaterThan(0);
    expect(result.commentsDetected).toBe(0);
  });

  test("2.2 - Should NOT trigger when monitored accounts create posts instead of comments", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      const commentResults: Record<string, number> = {};
      const postResults: Record<string, number> = {};

      // Test accounts known to post in this range
      const testAccounts = ["mtyszczak", "nickdongsik", "techstyle"];

      await new Promise<void>(resolve => {
        // Monitor multiple accounts for comments (should not trigger for post activity)
        bot.providePastOperations(96549390, 96549415).onComments(...testAccounts).subscribe({
          next(data) {
            testAccounts.forEach(account => {
              data.comments[account]?.forEach(() => {
                commentResults[account] = (commentResults[account] || 0) + 1;
              });
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Verify these accounts were active with posts
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onPosts(...testAccounts).subscribe({
          next(data) {
            testAccounts.forEach(account => {
              data.posts[account]?.forEach(() => {
                postResults[account] = (postResults[account] || 0) + 1;
              });
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

      return { commentResults, postResults };
    });

    const totalPosts = Object.values(result.postResults).reduce((sum, count) => sum + count, 0);
    const totalComments = Object.values(result.commentResults).reduce((sum, count) => sum + count, 0);

    expect(totalPosts).toBeGreaterThan(0);
    expect(totalComments).toBe(0);
  });

  test("2.2 - Should NOT trigger when different account creates comment", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let monitoredAccountComments = 0;
      let otherAccountComments = 0;

      // Monitor for comments from a specific account that doesn't commented
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549690, 96549715).onComments("nonexistent-commenter").subscribe({
          next(data) {
            data.comments["nonexistent-commenter"]?.forEach(() => {
              monitoredAccountComments++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Verify other accounts were commenting in this range
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549690, 96549715).onComments("gtg").subscribe({
          next(data) {
            data.comments["gtg"]?.forEach(() => {
              otherAccountComments++;
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

      return { monitoredAccountComments, otherAccountComments };
    });

    // Should NOT detect comments from monitored account, but should detect from other account
    expect(result.monitoredAccountComments).toBe(0);
    expect(result.otherAccountComments).toBeGreaterThan(0);
  });

  test("2.2 - Should handle empty account list for comments", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<boolean>((bot, resolve, reject) => {
      let dataReceived = false;

      try {
        // Test with no accounts (edge case)
        bot.providePastOperations(96549690, 96549715).onComments().subscribe({
          next(_data) {
            dataReceived = true;
            console.log("Data received for empty comment account list");
          },
          error(err) {
            console.error("Error with empty comment account list:", err);
            reject(err);
          },
          complete: () => resolve(dataReceived)
        });
      } catch {
        reject(new Error("Unexpected error occurred"));
      }
    });

    expect(result).toBeFalsy();
  });

  test("3.1 - Should trigger when any specified account votes - multiple accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedVotes: string[] = [];

      bot.providePastOperations(96549390, 96549415).onVotes("dhedge", "winanda").subscribe({
        next(data) {
          for (const voter of ["dhedge", "winanda"])
            data.votes[voter]?.forEach(({ operation }) => {
              capturedVotes.push(`Vote by ${operation.voter} on ${operation.author}/${operation.permlink}`);
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedVotes)
      });
    });

    expect(result).toEqual([
      "Vote by winanda on xlety/is-it-really-worth-creating",
      "Vote by dhedge on gpache/i-went-to-a-doctors-office-my-vision-is-improving-eng-esp",
      "Vote by dhedge on helicreamarket/sorpresa-al-horno-esp-eng"
    ]);
  });

  test("3.1 - Should trigger for simultaneous votes from multiple accounts in same block", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedVotes: Array<{ voter: string; blockNumber: number }> = [];

      bot.providePastOperations(96549390, 96549404).onBlock().or.onVotes("noctury", "the-burn").subscribe({
        next(data) {
          for (const voter of ["noctury", "the-burn"])
            data.votes[voter]?.forEach(({ operation }) => {
              capturedVotes.push({
                voter: operation.voter,
                blockNumber: data.block.number
              });
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedVotes)
      });
    });

    expect(result).toEqual([
      {
        voter: "noctury",
        blockNumber: 96549403
      },
      {
        voter: "the-burn",
        blockNumber: 96549403
      }
    ]);
  });

  test("3.2 - Should NOT trigger when account creates post/comment instead of voting", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let votesDetected = 0;
      let commentOperationsDetected = 0;

      await new Promise<void>(resolve => {
        // Monitor an account known to create posts/comments but does not vote in this range
        bot.providePastOperations(96549390, 96549415).onVotes("mtyszczak").subscribe({
          next(data) {
            // Count votes (should be 0)
            data.votes["mtyszczak"]?.forEach(() => {
              votesDetected++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Check for posts to verify account was active
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onPosts("mtyszczak").or.onComments("mtyszczak").subscribe({
          next(data) {
            data.posts["mtyszczak"]?.forEach(() => {
              commentOperationsDetected++;
            });

            data.comments["mtyszczak"]?.forEach(() => {
              commentOperationsDetected++;
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

      return { votesDetected, commentOperationsDetected };
    });

    // Should detect posts/comments but no votes from this account in this range
    expect(result.commentOperationsDetected).toBeGreaterThan(0);
    expect(result.votesDetected).toBe(0);
  });

  test("3.2 - Should NOT trigger when different account votes", async({ workerbeeTest }) => {
    const result = await workerbeeTest(async({ WorkerBee }) => {
      const bot = new WorkerBee({ chainOptions: { apiTimeout: 0 } });
      await bot.start();

      let monitoredAccountVotes = 0;
      let otherAccountVotes = 0;

      // Monitor for votes from a specific account that doesn't vote much
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onVotes("nonexistent-voter").subscribe({
          next(data) {
            data.votes["nonexistent-voter"]?.forEach(() => {
              monitoredAccountVotes++;
            });
          },
          error(err) {
            console.error(err);
          },
          complete: resolve
        });
      });

      // Verify other accounts were voting in this range
      await new Promise<void>(resolve => {
        bot.providePastOperations(96549390, 96549415).onVotes("noctury").subscribe({
          next(data) {
            data.votes["noctury"]?.forEach(() => {
              otherAccountVotes++;
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

      return { monitoredAccountVotes, otherAccountVotes };
    });

    // Should NOT detect votes from monitored account, but should detect from other account
    expect(result.monitoredAccountVotes).toBe(0);
    expect(result.otherAccountVotes).toBeGreaterThan(0);
  });

  test("3.2 - Should handle empty account list for votes", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<boolean>((bot, resolve, reject) => {
      let dataReceived = false;

      try {
        // Test with no accounts (edge case)
        bot.providePastOperations(96549390, 96549415).onVotes().subscribe({
          next(_data) {
            dataReceived = true;
            console.log("Data received for empty votes account list");
          },
          error(err) {
            console.error("Error with empty votes account list:", err);
            reject(err);
          },
          complete: () => resolve(dataReceived)
        });
      } catch {
        reject(new Error("Unexpected error occurred"));
      }
    });

    expect(result).toBeFalsy();
  });

  test("Multiple 'or' filters should work correctly", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: string[] = [];

      bot.providePastOperations(96549390, 96549415)
        .onPosts("mtyszczak").or.or.or.or.or.onComments("secret-art")
        .subscribe({
          next(data) {
            for (const author of ["mtyszczak", "secret-art"]) {
              data.posts[author]?.forEach(({ operation }) => {
                capturedPosts.push(`Post by ${operation.author}: ${operation.permlink}`);
              });

              data.comments[author]?.forEach(({ operation }) => {
                capturedPosts.push(`Comment by ${operation.author}: ${operation.permlink}`);
              });
            }

          },
          error(err) {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(capturedPosts)
        });
    });

    expect(result).toEqual([
      "Comment by secret-art: re-jfang003-sxg1lb",
      "Comment by secret-art: re-aussieninja-sxg1lm",
      "Post by mtyszczak: hi-ve-everyone",
      "Comment by secret-art: re-aussieninja-sxg1m5",
      "Comment by secret-art: re-jfang003-sxg1mg"
    ]);
  });
});
