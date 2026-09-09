import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { derivePermlink, Signer } = shared("broadcast");

const KEY = "5JNHfZYKGaomSFvd4NUdQ9qMcEAC43kujbfjueTHpVapX1Kzq2n";

/**
 * Stand-ins for wax and beekeeper, recording what the signer did with them.
 *
 * Fixture-based like the rest of the suite: no mocking library, and the fakes
 * implement only what `publishReply` actually calls.
 */
const libraries = ({ importKey, broadcast } = {}) => {
  const log = [];
  let sessions = 0;

  const wax = {
    ReplyOperation: class {
      constructor(options) {
        this.options = options;
      }
    },
  };

  const keeper = {
    createSession: (salt) => {
      sessions += 1;
      log.push(["createSession", salt]);
      return {
        close: () => log.push(["session.close", salt]),
        createWallet: async (name, password, isTemporary) => {
          log.push(["createWallet", name, password, isTemporary]);
          return {
            wallet: {
              importKey: async (wif) => {
                log.push(["importKey"]);
                if (importKey !== undefined) return importKey(wif);
                return "STM-public-key";
              },
            },
          };
        },
      };
    },
    delete: async () => log.push(["beekeeper.delete"]),
  };

  return {
    log,
    salts: () => log.filter(([verb]) => verb === "createSession").map(([, salt]) => salt),
    sessions: () => sessions,
    starts: () => log.filter(([verb]) => verb === "beekeeper.start").length,
    libraries: {
      wax: async () => wax,
      beekeeper: async () => {
        log.push(["beekeeper.start"]);
        return keeper;
      },
    },
    chain: {
      createTransaction: async () => ({
        id: "tx-1",
        pushOperation: (operation) => log.push(["pushOperation", operation.options.permlink]),
        sign: (wallet, publicKey) => log.push(["sign", publicKey]),
        broadcast: undefined,
      }),
      broadcast: async () => {
        log.push(["broadcast"]);
        if (broadcast !== undefined) return broadcast();
        return undefined;
      },
    },
  };
};

const request = (overrides = {}) => ({
  account: "neight.tester1",
  postingKey: KEY,
  parentAuthor: "hive.fund",
  parentPermlink: "some-post",
  body: "hello",
  ...overrides,
});

describe("publishing a reply", () => {
  it("signs and broadcasts, and reports the permlink it published under", async () => {
    const fake = libraries();
    const result = await new Signer(fake.libraries).publishReply(fake.chain, "https://api.hive.blog/", request());

    assert.equal(result.transactionId, "tx-1");
    assert.equal(result.author, "neight.tester1");
    assert.equal(result.parentAuthor, "hive.fund");
    assert.match(result.permlink, /^re-hive-fund-/, "a dotted parent must not put a dot in the permlink");

    const pushed = fake.log.find(([verb]) => verb === "pushOperation");
    assert.equal(pushed[1], result.permlink, "the permlink reported must be the one actually pushed");
    assert.ok(fake.log.some(([verb]) => verb === "broadcast"));
  });

  it("uses the caller's permlink when one is supplied, so a retry can be made idempotent", async () => {
    const fake = libraries();
    const result = await new Signer(fake.libraries).publishReply(fake.chain, "https://api.hive.blog/", request({ permlink: "fixed-permlink" }));

    assert.equal(result.permlink, "fixed-permlink");
  });

  it("never puts the posting key in the result", async () => {
    const fake = libraries();
    const result = await new Signer(fake.libraries).publishReply(fake.chain, "https://api.hive.blog/", request());

    assert.ok(!JSON.stringify(result).includes(KEY), "the key must not reach an item");
  });

  it("never puts the posting key in an error, however the library fails", async () => {
    /*
     * The library is third-party and its message is attached as a detail, so
     * this is the assertion that keeps that safe as versions move.
     */
    for (const fake of [
      libraries({ importKey: () => Promise.reject(new Error(`bad wif ${KEY}`)) }),
      libraries({ broadcast: () => Promise.reject(new Error(`rejected ${KEY}`)) }),
    ]) {
      const error = await new Signer(fake.libraries).publishReply(fake.chain, "https://api.hive.blog/", request()).catch((caught) => caught);

      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes(KEY), `the key leaked into: ${error.message}`);
    }
  });

  it("blames the endpoint only for a broadcast that the endpoint rejected", async () => {
    const fake = libraries({ broadcast: () => Promise.reject(new Error("socket hang up")) });
    const error = await new Signer(fake.libraries).publishReply(fake.chain, "https://api.hive.blog/", request()).catch((caught) => caught);

    assert.match(error.message, /rejected the reply from @neight\.tester1/);
    assert.equal(error.code, "upstream_error");
  });

  it("calls an unusable key a credential fault, not an endpoint fault", async () => {
    /*
     * The chain has not been asked anything yet. Reporting this as upstream made
     * it a NodeApiError, which blames a healthy Hive node -- and is the class
     * n8n's Retry on Fail exists for, so it would retry a key that will never
     * parse.
     */
    const fake = libraries({ importKey: () => Promise.reject(new Error("not a WIF")) });
    const error = await new Signer(fake.libraries).publishReply(fake.chain, "https://api.hive.blog/", request()).catch((caught) => caught);

    assert.equal(error.code, "credential_error");
    assert.ok(!error.message.includes("api.hive.blog"), "a bad key is not the endpoint's fault");
  });
});

describe("wallet caching", () => {
  it("unlocks one wallet per key and reuses it", async () => {
    const fake = libraries();
    const signer = new Signer(fake.libraries);

    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());
    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());

    assert.equal(fake.sessions(), 1, "the WASM wallet is far too expensive to rebuild per item");
    assert.equal(fake.starts(), 1, "and beekeeper starts once");
  });

  it("shares one wallet between publishes that start at the same time", async () => {
    /*
     * Two workflows publishing at once after a restart both miss the cache. The
     * wallet used to be named `hive-nodes-${wallets.size}`, read before the
     * cache was written, so both saw 0 and the second died on "already exists"
     * -- a lost reply, reported as an endpoint failure.
     */
    const fake = libraries();
    const signer = new Signer(fake.libraries);

    await Promise.all([
      signer.publishReply(fake.chain, "https://api.hive.blog/", request()),
      signer.publishReply(fake.chain, "https://api.hive.blog/", request()),
    ]);

    assert.equal(fake.starts(), 1, "a concurrent first publish must not start a second beekeeper");
    assert.equal(fake.sessions(), 1, "nor open a second wallet");
  });

  it("gives every wallet a random name rather than a counter", async () => {
    const fake = libraries();
    const signer = new Signer(fake.libraries);

    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());
    await signer.publishReply(fake.chain, "https://api.hive.blog/", request({ postingKey: `${KEY}-other` }));

    const [first, second] = fake.salts();
    assert.notEqual(first, second);
    for (const salt of [first, second]) assert.match(salt, /^hive-nodes-[0-9a-f-]{36}$/, "beekeeper requires a random session salt");
  });

  it("does not hold the posting key as a cache key", async () => {
    /*
     * Custody is supposed to live in the WASM heap. A plaintext WIF pinned as a
     * Map key for the life of the process, next to its own public key, is
     * trivially identifiable in a heap snapshot.
     */
    const fake = libraries();
    const signer = new Signer(fake.libraries);
    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());

    const keys = [...signer.cachedKeyIds];
    assert.equal(keys.length, 1);
    assert.notEqual(keys[0], KEY);
    assert.match(keys[0], /^[0-9a-f]{64}$/, "a digest, not the key");
  });

  it("still keeps two different keys apart", async () => {
    const fake = libraries();
    const signer = new Signer(fake.libraries);

    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());
    await signer.publishReply(fake.chain, "https://api.hive.blog/", request({ postingKey: `${KEY}-other` }));

    assert.equal(fake.sessions(), 2, "two credentials must not share one wallet");
  });

  it("closes the session when the key will not import, rather than leaking one per attempt", async () => {
    const fake = libraries({ importKey: () => Promise.reject(new Error("not a WIF")) });
    const signer = new Signer(fake.libraries);

    await assert.rejects(() => signer.publishReply(fake.chain, "https://api.hive.blog/", request()));
    await assert.rejects(() => signer.publishReply(fake.chain, "https://api.hive.blog/", request()));

    const closed = fake.log.filter(([verb]) => verb === "session.close").length;
    assert.equal(closed, 2, "each failed unlock must clean up after itself");
  });

  it("retries beekeeper after a failed start instead of caching the rejection", async () => {
    let attempts = 0;
    const fake = libraries();
    const flaky = {
      wax: fake.libraries.wax,
      beekeeper: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("WASM did not start");
        return fake.libraries.beekeeper();
      },
    };
    const signer = new Signer(flaky);

    await assert.rejects(() => signer.publishReply(fake.chain, "https://api.hive.blog/", request()));
    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());

    assert.equal(attempts, 2, "a failed start must not wedge every later publish in the process");
  });

  it("shuts beekeeper down without floating the promise it returns", async () => {
    const fake = libraries();
    const signer = new Signer(fake.libraries);

    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());
    await signer.forget();

    assert.ok(fake.log.some(([verb]) => verb === "beekeeper.delete"));

    await signer.publishReply(fake.chain, "https://api.hive.blog/", request());
    assert.equal(fake.starts(), 2, "after forgetting, the next publish starts a fresh beekeeper");
  });
});

describe("reply permlinks", () => {
  it("strips whatever the chain would reject", () => {
    /*
     * Validate_permlink_0_1 allows only lowercase letters, digits and hyphens,
     * and dotted account names are ordinary on Hive.
     */
    assert.match(derivePermlink("hive.fund"), /^re-hive-fund-[0-9a-z]+$/);
    assert.match(derivePermlink("Peak.Snaps"), /^re-peak-snaps-[0-9a-z]+$/);
    assert.match(derivePermlink("--alice--"), /^re-alice-[0-9a-z]+$/);
  });
});
