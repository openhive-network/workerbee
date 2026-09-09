/**
 * Signing and broadcasting, kept apart from everything else in this package.
 *
 * Every other module here is read-only: it asks a Hive node questions and never
 * proves who is asking. This one holds a posting key long enough to sign a
 * transaction, which makes it the only place in the package that can change the
 * chain. That is why it is its own file, its own credential
 * (`HivePostingKey`), and its own operation on the node. The beekeeper WASM is
 * loaded on first use, so a workflow that never touches `Comment: Reply` never
 * pays for it -- the module itself is imported with the node either way.
 *
 * ## How a signature is produced
 *
 * wax cannot sign from a raw WIF: `ITransaction.sign` wants an
 * `ISignatureProvider`, which is what a beekeeper wallet is. So the key is
 * imported into an **in-memory** beekeeper wallet -- `inMemory: true`, so
 * nothing is ever written to disk -- and the wallet signs the transaction's
 * digest.
 *
 * ## The key
 *
 * It arrives from an n8n credential, which n8n stores encrypted. From there it
 * lives in this process only: it is never logged, never attached to an error,
 * and never returned in an item. Errors from here quote the account name and the
 * endpoint, never the key.
 */
import { createHash, randomUUID } from "node:crypto";

import { CredentialError, UpstreamError } from "./errors";
import type { IHiveChainInterface, IBeekeeperInstance, IBeekeeperUnlockedWallet, TBeekeeperModule, TPublicKey, TWaxModule } from "./wax-types";

const BEEKEEPER_MODULE = "@hiveio/beekeeper";
const WAX_MODULE = "@hiveio/wax";

/** What a caller needs to publish one reply. */
export interface IReplyRequest {
  account: string;
  postingKey: string;
  parentAuthor: string;
  parentPermlink: string;
  body: string;
  /** Omitted, {@link derivePermlink} builds one from the parent and the clock. */
  permlink?: string;
  title?: string;
}

export interface IReplyResult {
  transactionId: string;
  author: string;
  permlink: string;
  parentAuthor: string;
  parentPermlink: string;
}

interface IUnlocked {
  wallet: IBeekeeperUnlockedWallet;
  publicKey: TPublicKey;
}

/**
 * Take the key out of a message this module did not write.
 *
 * The messages attached as error details come from wax and beekeeper, and an
 * n8n error detail is persisted with the execution. Neither library echoes a
 * WIF today -- checked against these versions -- but "it does not happen to leak
 * right now" is an audit, not an invariant, and this is the one string on this
 * path that leaves the process. Cheap enough to make it an invariant.
 */
function scrub(message: string, postingKey: string): string {
  return postingKey === "" ? message : message.split(postingKey).join("[posting key]");
}

/**
 * How this module reaches the two ESM-only libraries.
 *
 * The same seam `chain.ts` has, for the same reason: the one function in this
 * package that signs and broadcasts is the one that most needs a test, and it
 * could not have one while its dependencies were dynamic imports of fixed
 * specifiers. Production passes nothing and gets the real ones.
 */
export interface ISigningLibraries {
  wax(): Promise<TWaxModule>;
  beekeeper(): Promise<IBeekeeperInstance>;
}

const liveLibraries: ISigningLibraries = {
  wax: async () => (await import(WAX_MODULE)) as TWaxModule,
  beekeeper: async () => {
    const module = (await import(BEEKEEPER_MODULE)) as TBeekeeperModule;
    // With `inMemory` there is no wallet file, so the key cannot outlive the process.
    return module.default({ inMemory: true, enableLogs: false });
  },
};

/** Holds the unlocked wallets and turns a reply into a signed transaction. */
export class Signer {
  public constructor(private readonly libraries: ISigningLibraries = liveLibraries) {}

  /**
   * One beekeeper per signer, and one unlocked wallet per key.
   *
   * Starting beekeeper means instantiating WebAssembly, which is far too much to
   * repeat per item. Keyed by a digest of the posting key, so two credentials
   * with different accounts stay apart without the key itself becoming a Map
   * key: the point of routing through beekeeper is that custody lives in the
   * WASM heap, and a plaintext WIF held for the life of the process, next to its
   * own derived public key, is trivially recoverable from a heap snapshot.
   *
   * Both caches hold the *in-flight promise*, not just the finished value. Two
   * workflows publishing at the same time after a restart both miss the cache,
   * and without this the second one starts a second beekeeper -- orphaning the
   * first WASM instance -- and collides on the wallet name.
   */
  private beekeeper: Promise<IBeekeeperInstance> | undefined;

  private readonly wallets = new Map<string, IUnlocked>();

  private readonly unlocking = new Map<string, Promise<IUnlocked>>();

  /**
   * What the unlocked wallets are cached under.
   *
   * Exposed so the invariant can be asserted rather than assumed: these are
   * SHA-256 digests, and a posting key must never appear among them.
   */
  public get cachedKeyIds(): readonly string[] {
    return [...this.wallets.keys()];
  }

  private instance(): Promise<IBeekeeperInstance> {
    this.beekeeper ??= this.libraries.beekeeper().catch((error: unknown) => {
      /*
       * A failed start must not stay cached, or every later publish in this
       * process replays the same rejection without ever retrying.
       */
      this.beekeeper = undefined;
      throw error;
    });

    return this.beekeeper;
  }

  private unlockedWallet(postingKey: string): Promise<IUnlocked> {
    const id = createHash("sha256").update(postingKey).digest("hex");

    const cached = this.wallets.get(id);
    if (cached !== undefined) return Promise.resolve(cached);

    const inFlight = this.unlocking.get(id);
    if (inFlight !== undefined) return inFlight;

    const promise = this.unlock(postingKey, id).finally(() => this.unlocking.delete(id));
    this.unlocking.set(id, promise);
    return promise;
  }

  private async unlock(postingKey: string, id: string): Promise<IUnlocked> {
    const keeper = await this.instance();

    /*
     * Random, as beekeeper's own documentation requires of a session salt. The
     * name used to be `hive-nodes-${wallets.size}`, read before the cache was
     * written, so two concurrent first publishes both saw 0 and the second died
     * on "wallet is temporary and already exists" -- a lost reply, reported as
     * an endpoint failure.
     */
    const name = `hive-nodes-${randomUUID()}`;
    const session = keeper.createSession(name);

    try {
      /*
       * The third argument is `isTemporary`; `undefined` lets beekeeper generate
       * the password, which under inMemory storage is never persisted anyway.
       */
      const { wallet } = await session.createWallet(name, undefined, true);
      const publicKey = await wallet.importKey(postingKey);

      const entry = { wallet, publicKey };
      this.wallets.set(id, entry);
      return entry;
    } catch (error) {
      /*
       * The session and any half-built wallet are useless now, and a bad key
       * retried per item would otherwise leak one of each per attempt.
       */
      session.close();
      /*
       * Deliberately does not echo the key, not even a prefix of it -- and the
       * library's own message is scrubbed, because it is not ours to trust.
       * A credential fault, not an endpoint fault: the chain has not been asked
       * anything yet. Reporting it as upstream made it a NodeApiError, which
       * blames the Hive node and invites n8n to retry it.
       */
      throw new CredentialError("The posting key in the Hive Posting Key credential could not be unlocked", scrub((error as Error).message, postingKey), error);
    }
  }

  /**
   * Publish one reply and return what was published.
   *
   * The transaction is signed and broadcast in one step; there is no dry run,
   * because a Hive comment cannot be taken back once it is in a block.
   */
  public async publishReply(chain: IHiveChainInterface, endpoint: string, request: IReplyRequest): Promise<IReplyResult> {
    const wax = await this.libraries.wax();
    const { wallet, publicKey } = await this.unlockedWallet(request.postingKey);

    const permlink = request.permlink ?? derivePermlink(request.parentAuthor);

    const transaction = await chain.createTransaction();
    transaction.pushOperation(
      new wax.ReplyOperation({
        author: request.account,
        parentAuthor: request.parentAuthor,
        parentPermlink: request.parentPermlink,
        body: request.body,
        permlink,
        ...(request.title === undefined ? {} : { title: request.title }),
      }),
    );

    transaction.sign(wallet, publicKey);

    try {
      await chain.broadcast(transaction);
    } catch (error) {
      throw new UpstreamError(
        `Hive endpoint ${endpoint} rejected the reply from @${request.account}`,
        scrub((error as Error).message, request.postingKey),
        error,
      );
    }

    return {
      transactionId: transaction.id,
      author: request.account,
      permlink,
      parentAuthor: request.parentAuthor,
      parentPermlink: request.parentPermlink,
    };
  }

  /**
   * Forget every unlocked wallet and shut beekeeper down.
   *
   * Nothing in the package calls this yet -- it is the hook a process-level
   * shutdown would use, and the tests' way of starting from nothing.
   */
  public async forget(): Promise<void> {
    this.wallets.clear();
    this.unlocking.clear();

    const started = this.beekeeper;
    this.beekeeper = undefined;
    if (started === undefined) return;

    /*
     * Awaited and caught: `delete()` returns a promise, and floating it turned a
     * failure on shutdown into an unhandled rejection, which under Node's
     * default takes the n8n process down with it.
     */
    await started.then((keeper) => keeper.delete?.()).catch(() => undefined);
  }
}

/** Process-wide signer. n8n loads this module once, so one signer serves every node. */
export const signer = new Signer();

/**
 * A permlink for a reply, derived rather than left to wax.
 *
 * wax builds `re-<parentAuthor>-<timestamp>`, which the chain rejects outright
 * when the parent's name contains a dot: `validate_permlink_0_1` allows only
 * lowercase letters, digits and hyphens. Dotted account names are ordinary on
 * Hive -- `hive.fund`, `peak.snaps` -- so a bot answering whoever replies would
 * fail on them, and only on them, with an error about an invalid character.
 */
export function derivePermlink(parentAuthor: string): string {
  const stem = parentAuthor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `re-${stem}-${Date.now().toString(36)}`;
}
