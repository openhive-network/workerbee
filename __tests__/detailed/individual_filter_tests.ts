/* eslint-disable no-console */
import { expect } from "@playwright/test";
import { test } from "../assets/jest-helper";

test.describe("WorkerBee Individual Filter Verification", () => {
  test("1.1 - Should trigger when any specified account creates post - multiple accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: string[] = [];

      bot.onPosts("mtyszczak", "author2", "author3").subscribe({
        next(data) {
          for (const author of ["mtyszczak", "author2", "author3"])
            data.posts[author as "mtyszczak" | "author2" | "author3"]?.forEach(({ operation }) => {
              capturedPosts.push(`Post by ${operation.author}: ${operation.permlink}`);
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedPosts)
      });
    }, 96549390, 96549415);

    expect(result).toEqual(["Post by mtyszczak: hi-ve-everyone"]);
  });

  test("1.1 - Should trigger for simultaneous posts from multiple accounts in same block", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: Array<{ author: string; blockNumber: number }> = [];

      bot.onBlock().onPosts("comandoyeya", "daddydog").subscribe({
        next(data) {
          for (const author of ["comandoyeya", "daddydog"])
            data.posts[author as "comandoyeya" | "daddydog"]?.forEach(({ operation }) => {
              capturedPosts.push({
                author: operation.author,
                blockNumber: data.block!.number
              });
            });

        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedPosts)
      });
    }, 97632050, 97632075);

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

  test("1.2 - Should NOT trigger when account creates comment instead of post", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      let postsDetected = 0;
      let commentsDetected = 0;

      /*
       * Monitor an account known to create comments in this range.
       * Also check for comments in the same range to verify account was active
       */
      bot.onPosts("gtg").onComments("gtg").subscribe({
        next(data) {
          // Count posts (should be 0)
          data.posts["gtg"]?.forEach(() => {
            postsDetected++;
          });

          // Count comments (should be > 0)
          data.comments["gtg"]?.forEach(() => {
            commentsDetected++;
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ postsDetected, commentsDetected })
      });
    }, 96549690, 96549715);

    // Should detect comments but NOT posts
    expect(result.commentsDetected).toBeGreaterThan(0);
    expect(result.postsDetected).toBe(0);
  });

  test("1.2 - Should NOT trigger when monitored accounts create comments instead of posts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<{ postResults: Record<string, number>; commentResults: Record<string, number> }>((bot, resolve, reject) => {
      const postResults: Record<string, number> = {};
      const commentResults: Record<string, number> = {};

      // Test accounts known to comment in this range
      const testAccounts = ["gtg", "moretea", "khantaimur"];

      /*
       * Monitor multiple accounts for posts (should not trigger for comment activity)
       * Also Verify these accounts were active with comments
       */
      bot.onPosts(...testAccounts).onComments(...testAccounts).subscribe({
        next(data) {
          testAccounts.forEach(account => {
            data.posts[account]?.forEach(() => {
              postResults[account] = (postResults[account] || 0) + 1;
            });

            data.comments[account]?.forEach(() => {
              commentResults[account] = (commentResults[account] || 0) + 1;
            });
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ postResults, commentResults })
      });
    }, 96549690, 96549715);

    const totalComments = Object.values(result.commentResults).reduce((sum, count) => sum + count, 0);
    const totalPosts = Object.values(result.postResults).reduce((sum, count) => sum + count, 0);

    expect(totalComments).toBeGreaterThan(0);
    expect(totalPosts).toBe(0);
  });

  test("1.2 - Should NOT trigger when different account creates post", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<{ monitoredAccountPosts: number; otherAccountPosts: number }>((bot, resolve, reject) => {
      let monitoredAccountPosts = 0;
      let otherAccountPosts = 0;

      /*
       * Monitor for posts from a specific account
       * Also Verify other accounts were posting in this range
       */
      bot.onPosts("nonexistent-account").onPosts("mtyszczak").subscribe({
        next(data) {
          data.posts["nonexistent-account"]?.forEach(() => {
            monitoredAccountPosts++;
          });

          data.posts["mtyszczak"]?.forEach(() => {
            otherAccountPosts++;
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ monitoredAccountPosts, otherAccountPosts })
      });
    }, 96549390, 96549415);

    // Should NOT detect posts from monitored account, but should detect from other account
    expect(result.monitoredAccountPosts).toBe(0);
    expect(result.otherAccountPosts).toBeGreaterThan(0);
  });

  test("1.2 - Should handle empty account list", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<boolean>((bot, resolve, reject) => {
      let dataReceived = false;

      try {
        // Test with no accounts (edge case)
        bot.onPosts().subscribe({
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
    }, 96549390, 96549415);

    expect(result).toBeFalsy();
  });

  test("2.1 - Should trigger when any specified account creates comment - multiple accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedComments: string[] = [];

      (bot).onComments("gtg", "moretea", "khantaimur").subscribe({
        next(data) {
          for (const author of ["gtg", "moretea", "khantaimur"])
            data.comments[author as "gtg" | "moretea" | "khantaimur"]?.forEach(({ operation }) => {
              capturedComments.push(`Comment by ${operation.author}: ${operation.permlink}`);
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedComments)
      });
    }, 96549690, 96549715);

    expect(result).toEqual([
      "Comment by moretea: re-leothreads-2xpn8nyzd",
      "Comment by khantaimur: re-vkcmjbdble",
      "Comment by gtg: re-mtyszczak-1749229740753"
    ]);
  });

  test("2.1 - Should trigger for simultaneous comments from multiple accounts in same block", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedComments: Array<{ author: string; blockNumber: number }> = [];

      (bot).onBlock().onComments("zayyar99", "beckyroyal").subscribe({
        next(data) {
          for (const author of ["zayyar99", "beckyroyal"])
            data.comments[author as "zayyar99" | "beckyroyal"]?.forEach(({ operation }) => {
              capturedComments.push({
                author: operation.author,
                blockNumber: data.block!.number
              });
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedComments)
      });
    }, 97634334, 97634348);

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

  test("2.2 - Should NOT trigger when account creates post instead of comment", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      let commentsDetected = 0;
      let postsDetected = 0;


      /*
       * Monitor an account known to create posts in this range for comments (should not trigger)
       * Also check for posts in the same range to verify account was active with posts
       */
      (bot).onComments("mtyszczak").onPosts("mtyszczak").subscribe({
        next(data) {
          // Count comments (should be 0)
          data.comments["mtyszczak"]?.forEach(() => {
            commentsDetected++;
          });

          // Count posts (should be > 0)
          data.posts["mtyszczak"]?.forEach(() => {
            postsDetected++;
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ commentsDetected, postsDetected })
      });
    }, 96549390, 96549415);

    // Should detect posts but NOT comments
    expect(result.postsDetected).toBeGreaterThan(0);
    expect(result.commentsDetected).toBe(0);
  });

  test("2.2 - Should NOT trigger when monitored accounts create posts instead of comments", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<{ commentResults: Record<string, number>; postResults: Record<string, number> }>((bot, resolve, reject) => {
      const commentResults: Record<string, number> = {};
      const postResults: Record<string, number> = {};

      // Test accounts known to post in this range
      const testAccounts = ["mtyszczak", "nickdongsik", "techstyle"];

      /*
       * Monitor multiple accounts for comments (should not trigger for post activity)
       * Also verify these accounts were active with posts
       */
      (bot).onComments(...testAccounts).onPosts(...testAccounts).subscribe({
        next(data) {
          testAccounts.forEach(account => {
            data.comments[account]?.forEach(() => {
              commentResults[account] = (commentResults[account] || 0) + 1;
            });

            data.posts[account]?.forEach(() => {
              postResults[account] = (postResults[account] || 0) + 1;
            });
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ commentResults, postResults })
      });
    }, 96549390, 96549415);

    const totalPosts = Object.values(result.postResults).reduce((sum, count) => sum + count, 0);
    const totalComments = Object.values(result.commentResults).reduce((sum, count) => sum + count, 0);

    expect(totalPosts).toBeGreaterThan(0);
    expect(totalComments).toBe(0);
  });

  test("2.2 - Should NOT trigger when different account creates comment", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      let monitoredAccountComments = 0;
      let otherAccountComments = 0;

      /*
       * Monitor for comments from a specific account that doesn't commented
       * Also verify other accounts were commenting in this range
       */
      (bot).onComments("nonexistent-commenter").onComments("gtg").subscribe({
        next(data) {
          data.comments["nonexistent-commenter"]?.forEach(() => {
            monitoredAccountComments++;
          });

          data.comments["gtg"]?.forEach(() => {
            otherAccountComments++;
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ monitoredAccountComments, otherAccountComments })
      });
    }, 96549690, 96549715);

    // Should NOT detect comments from monitored account, but should detect from other account
    expect(result.monitoredAccountComments).toBe(0);
    expect(result.otherAccountComments).toBeGreaterThan(0);
  });

  test("2.2 - Should handle empty account list for comments", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<boolean>((bot, resolve, reject) => {
      let dataReceived = false;

      try {
        // Test with no accounts (edge case)
        (bot).onComments().subscribe({
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
    }, 96549690, 96549715);

    expect(result).toBeFalsy();
  });

  test("2.3 - Should trigger when any specified account creates post or comment", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: string[] = [];

      (bot)
        .onPosts("mtyszczak", "author2", "author3")
        .onComments("secret-art", "author2", "author3")
        .subscribe({
          next(data) {
            for (const author of ["mtyszczak", "secret-art", "author2", "author3"]) {
              data.comments[author as "secret-art" | "author2" | "author3"]?.forEach(({ operation }) => {
                capturedPosts.push(`Comment by ${operation.author}: ${operation.permlink}`);
              });

              data.posts[author as "mtyszczak" | "author2" | "author3"]?.forEach(({ operation }) => {
                capturedPosts.push(`Post by ${operation.author}: ${operation.permlink}`);
              });
            }
          },
          error(err) {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(capturedPosts)
        });
    }, 96549390, 96549415);

    expect(result).toEqual([
      "Comment by secret-art: re-jfang003-sxg1lb",
      "Comment by secret-art: re-aussieninja-sxg1lm",
      "Post by mtyszczak: hi-ve-everyone",
      "Comment by secret-art: re-aussieninja-sxg1m5",
      "Comment by secret-art: re-jfang003-sxg1mg"
    ]);
  });

  test("3.1 - Should trigger when any specified account votes - multiple accounts", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedVotes: string[] = [];

      (bot).onVotes("dhedge", "winanda").subscribe({
        next(data) {
          for (const voter of ["dhedge", "winanda"])
            data.votes[voter as "dhedge" | "winanda"]?.forEach(({ operation }) => {
              capturedVotes.push(`Vote by ${operation.voter} on ${operation.author}/${operation.permlink}`);
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedVotes)
      });
    }, 96549390, 96549415);

    expect(result).toEqual([
      "Vote by winanda on xlety/is-it-really-worth-creating",
      "Vote by dhedge on gpache/i-went-to-a-doctors-office-my-vision-is-improving-eng-esp",
      "Vote by dhedge on helicreamarket/sorpresa-al-horno-esp-eng"
    ]);
  });

  test("3.1 - Should trigger for simultaneous votes from multiple accounts in same block", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedVotes: Array<{ voter: string; blockNumber: number }> = [];

      (bot).onBlock().onVotes("noctury", "the-burn").subscribe({
        next(data) {
          for (const voter of ["noctury", "the-burn"])
            data.votes[voter as "noctury" | "the-burn"]?.forEach(({ operation }) => {
              capturedVotes.push({
                voter: operation.voter,
                blockNumber: data.block!.number
              });
            });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve(capturedVotes)
      });
    }, 96549390, 96549404);

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

  test("3.2 - Should NOT trigger when account creates post/comment instead of voting", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      let votesDetected = 0;
      let commentOperationsDetected = 0;

      /*
       * Monitor an account known to create posts/comments but does not vote in this range
       * Also Check for posts to verify account was active
       */
      (bot).onVotes("mtyszczak").onPosts("mtyszczak").onComments("mtyszczak").subscribe({
        next(data) {
          // Count votes (should be 0)
          data.votes["mtyszczak"]?.forEach(() => {
            votesDetected++;
          });

          // Count comments (should be > 0)
          data.comments["mtyszczak"]?.forEach(() => {
            commentOperationsDetected++;
          });

          data.posts["mtyszczak"]?.forEach(() => {
            commentOperationsDetected++;
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ votesDetected, commentOperationsDetected })
      });
    }, 96549390, 96549415);

    // Should detect posts/comments but no votes from this account in this range
    expect(result.commentOperationsDetected).toBeGreaterThan(0);
    expect(result.votesDetected).toBe(0);
  });

  test("3.2 - Should NOT trigger when different account votes", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      let monitoredAccountVotes = 0;
      let otherAccountVotes = 0;

      /*
       * Monitor for votes from a specific account that doesn't vote much
       * Also Verify other accounts were voting in this range
       */
      (bot).onVotes("nonexistent-voter").onVotes("noctury").subscribe({
        next(data) {
          data.votes["nonexistent-voter"]?.forEach(() => {
            monitoredAccountVotes++;
          });

          data.votes["noctury"]?.forEach(() => {
            otherAccountVotes++;
          });
        },
        error(err) {
          console.error(err);
          reject(err);
        },
        complete: () => resolve({ monitoredAccountVotes, otherAccountVotes })
      });
    }, 96549390, 96549415);

    // Should NOT detect votes from monitored account, but should detect from other account
    expect(result.monitoredAccountVotes).toBe(0);
    expect(result.otherAccountVotes).toBeGreaterThan(0);
  });

  test("3.2 - Should handle empty account list for votes", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest<boolean>((bot, resolve, reject) => {
      let dataReceived = false;

      try {
        // Test with no accounts (edge case)
        (bot).onVotes().subscribe({
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
    }, 96549390, 96549415);

    expect(result).toBeFalsy();
  });

  test("Multiple 'and' filters should work correctly", async({ createWorkerBeeTest }) => {
    const result = await createWorkerBeeTest((bot, resolve, reject) => {
      const capturedPosts: string[] = [];

      (bot)
        .onPosts("mtyszczak").and.and.and.and.and.and.onVotes("jacor").provideBlockData()
        .subscribe({
          next(data) {
            for (const author of ["mtyszczak", "jacor"]) {
              data.posts[author as keyof typeof data["posts"]]?.forEach(({ operation }) => {
                capturedPosts.push(`Post by ${operation.author}: ${operation.permlink} in block ${data.block!.number}`);
              });

              data.votes[author as keyof typeof data["votes"]]?.forEach(({ operation }) => {
                capturedPosts.push(`Vote by ${operation.voter}: ${operation.permlink} in block ${data.block!.number}`);
              });
            }

          },
          error(err) {
            console.error(err);
            reject(err);
          },
          complete: () => resolve(capturedPosts)
        });
    }, 96549390, 96549415);

    expect(result).toEqual([
      "Post by mtyszczak: hi-ve-everyone in block 96549402",
      "Vote by jacor: i-went-to-a-doctors-office-my-vision-is-improving-eng-esp in block 96549402",
    ]);
  });
});
