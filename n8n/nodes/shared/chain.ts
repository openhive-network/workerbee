/**
 * One shared WorkerBee per Hive endpoint, for the whole n8n process.
 *
 * This is what makes an in-process node worth having: `ObserverMediator` already
 * multiplexes any number of listeners over a single block stream, so fifty
 * workflows watching Hive cost one poller here instead of fifty independent ones
 * hammering the API node. Bots are reference-counted, so deactivating the last
 * workflow on an endpoint really does stop polling it.
 *
 * ## Why everything here is loaded with `await import(...)`
 *
 * `@hiveio/wax` is an ESM-only package and the WorkerBee build that wraps it is
 * ESM too, while an n8n node must be CommonJS -- n8n `require()`s the compiled
 * `*.node.js`. A static `import` would therefore either fail to resolve at
 * runtime or force the whole package to ESM. A dynamic `import()` from CommonJS
 * is the supported bridge between the two, and it has a second benefit: nothing
 * WASM-shaped is loaded while n8n is merely scanning the nodes directory, so the
 * editor stays responsive and a broken chain cannot stop the package loading.
 *
 * The specifiers are held in variables so that TypeScript does not rewrite them
 * for the CommonJS target; the types come from the matching `import type` above.
 */
import type { IWorkerBee } from "../../workerbee/index";
import { HiveNodeError, UpstreamError } from "./errors";
import type { IHiveChainInterface, TWaxModule } from "./wax-types";

/** Resolved at runtime from `dist/workerbee/index.mjs`, next to the compiled nodes. */
const WORKERBEE_MODULE = "../../workerbee/index.mjs";
const WAX_MODULE = "@hiveio/wax";

type TWorkerBeeModule = typeof import("../../workerbee/index");

/**
 * How many endpoints may stay resident.
 *
 * The endpoint is caller-supplied (a credential, or a per-subscription override),
 * so an unbounded cache would let a workflow open connections without limit.
 * Entries still in use by a trigger are never evicted.
 */
const MAX_RESIDENT_ENDPOINTS = 8;

export const DEFAULT_ENDPOINT = "https://api.hive.blog/";

interface IEntry {
  endpoint: string;
  chain: IHiveChainInterface;
  bot: IWorkerBee;
  /** Triggers currently subscribed through this bot. */
  refs: number;
  /**
   * Whether the block poller is running.
   *
   * Tracked here rather than read from `WorkerBee.running`, which reports the
   * timer handle it was given and is never cleared by `stop()` -- so it stays
   * `true` for the life of the bot once started. Trusting it would mean never
   * restarting a poller after the last trigger had stopped it.
   */
  polling: boolean;
  lastUsed: number;
}

export interface IBotHandle {
  readonly bot: IWorkerBee;
  readonly endpoint: string;
  /** Drop this trigger's reference; stops the bot when it was the last one. */
  release(): void;
}

/**
 * How the pool obtains a chain and a bot.
 *
 * The one seam in this file, and it exists for the tests: the pool's job is to
 * decide *when* the poller runs, and that cannot be asserted while the only
 * witness is a flag the pool sets itself. A recording factory lets a test watch
 * `start()` and `stop()` instead -- and keeps the suite off the network, which
 * it claimed to be but was not.
 */
export interface IBotFactory {
  create(endpoint: string, chainId?: string): Promise<{ chain: IHiveChainInterface; bot: IWorkerBee }>;
}

const liveBots: IBotFactory = {
  create: async (endpoint, chainId) => {
    const wax = (await import(WAX_MODULE)) as TWaxModule;
    const workerbee = (await import(WORKERBEE_MODULE)) as TWorkerBeeModule;

    /*
     * The chain id is what a signature is computed over, so a testnet or a
     * mirrornet needs its own. Reads do not care -- which is why this went
     * unnoticed until the first broadcast, where the node rejects the
     * signature as `tx_missing_posting_auth`: the key is right, the chain it
     * was signed for is not. Omitted, wax uses mainnet's.
     *
     * Entries stay keyed by endpoint alone: one endpoint serves one chain, so
     * a second chain id for the same URL would be a misconfiguration rather
     * than a case to support.
     */
    const chain = await wax.createHiveChain(chainId === undefined ? { apiEndpoint: endpoint } : { apiEndpoint: endpoint, chainId });
    /*
     * Deliberately not started: `acquire` starts the poller, `release` stops
     * it, and a chain read needs neither.
     */
    return { chain, bot: new workerbee.default(chain) };
  },
};

export class BotPool {
  public constructor(private readonly bots: IBotFactory = liveBots) {}

  private readonly entries = new Map<string, IEntry>();
  private readonly opening = new Map<string, Promise<IEntry>>();

  /**
   * Uses in flight per endpoint.
   *
   * Keyed by endpoint rather than held on the entry, because a use is claimed
   * before `open()` has produced an entry to hang it on. `refs` alone cannot
   * protect a chain: a one-shot read takes no reference at all, and an `acquire`
   * has not taken one yet while `open()` is still awaiting. In both windows
   * `evict()` would `delete()` the chain out from under the caller, who then
   * reads freed WASM memory.
   */
  private readonly leases = new Map<string, number>();

  private lease(endpoint: string): void {
    this.leases.set(endpoint, (this.leases.get(endpoint) ?? 0) + 1);
  }

  private unlease(endpoint: string): void {
    const held = (this.leases.get(endpoint) ?? 0) - 1;
    if (held > 0) this.leases.set(endpoint, held);
    else this.leases.delete(endpoint);
  }

  public get size(): number {
    return this.entries.size;
  }

  public get endpoints(): string[] {
    return [...this.entries.keys()].sort();
  }

  /** Endpoints with a read in flight, so `evict()` cannot free the chain under it. */
  public get leased(): string[] {
    return [...this.leases.keys()].sort();
  }

  /** Endpoints whose block poller is currently running, for `Chain: Get Health`. */
  public get polling(): string[] {
    return [...this.entries.values()].filter((entry) => entry.polling).map((entry) => entry.endpoint).sort();
  }

  /**
   * Take a counted reference to the bot for `endpoint`, opening it on first use.
   *
   * The block poller runs only while at least one reference is held, so an n8n
   * that uses the action node alone never polls, and deactivating the last
   * workflow on an endpoint really does stop the traffic to it.
   */
  public async acquire(endpoint: string, chainId?: string): Promise<IBotHandle> {
    /*
     * The lease is held across `open()` only: from `refs += 1` onwards the
     * reference itself is what keeps `evict()` off this entry.
     */
    this.lease(endpoint);
    let entry: IEntry | undefined;
    try {
      entry = await this.open(endpoint, chainId);
      entry.refs += 1;
      /*
       * Inside the reference, so a throwing `start()` rolls it back instead of
       * pinning the entry at refs=1 for the life of the process -- never
       * evictable, never polling, and holding one of the eight slots.
       */
      if (!entry.polling) {
        entry.bot.start();
        entry.polling = true;
      }
      return this.handle(entry);
    } catch (error) {
      if (entry !== undefined) entry.refs = Math.max(0, entry.refs - 1);
      throw error;
    } finally {
      this.unlease(endpoint);
    }
  }

  private handle(entry: IEntry): IBotHandle {
    let released = false;
    return {
      bot: entry.bot,
      endpoint: entry.endpoint,
      release: () => {
        if (released) return;
        released = true;
        /*
         * The entry may have been closed and replaced meanwhile; decrementing the
         * stale one would leave the live entry's `refs` permanently above zero and
         * its poller running for ever.
         */
        if (this.entries.get(entry.endpoint) !== entry) return;

        entry.refs = Math.max(0, entry.refs - 1);
        entry.lastUsed = Date.now();
        // The chain stays warm for one-shot reads; only the poller stops.
        if (entry.refs === 0 && entry.polling) {
          entry.bot.stop();
          entry.polling = false;
        }
        this.evict();
      },
    };
  }

  /**
   * Run one read-only API call against the wax chain behind `endpoint`.
   *
   * The chain is handed to a callback rather than returned so the pool knows when
   * the call is over. A returned chain outlives the pool's knowledge of it, and
   * `evict()` would happily `delete()` it mid-request.
   */
  public async withChain<T>(endpoint: string, use: (chain: IHiveChainInterface) => Promise<T>, chainId?: string): Promise<T> {
    this.lease(endpoint);
    try {
      const entry = await this.open(endpoint, chainId);
      entry.lastUsed = Date.now();
      return await use(entry.chain);
    } finally {
      this.unlease(endpoint);
      this.evict();
    }
  }

  private open(endpoint: string, chainId?: string): Promise<IEntry> {
    const existing = this.entries.get(endpoint);
    if (existing !== undefined) {
      existing.lastUsed = Date.now();
      return Promise.resolve(existing);
    }

    /*
     * Two triggers activating at once must share one bot, so the in-flight
     * promise is what gets cached, not just the finished entry.
     */
    const inFlight = this.opening.get(endpoint);
    if (inFlight !== undefined) return inFlight;

    const promise = this.create(endpoint, chainId).finally(() => this.opening.delete(endpoint));
    this.opening.set(endpoint, promise);
    return promise;
  }

  private async create(endpoint: string, chainId?: string): Promise<IEntry> {
    let chain: IHiveChainInterface | undefined;
    try {
      const created = await this.bots.create(endpoint, chainId);
      chain = created.chain;
      const bot = created.bot;

      /*
       * `closeAll()` clears `opening`, so a missing key means a shutdown swept
       * past while this was connecting. Publishing now would leave a bot running
       * after the pool believed it had stopped everything.
       */
      if (!this.opening.has(endpoint)) {
        bot.delete();
        throw new HiveNodeError(`The Hive connection pool was closed while ${endpoint} was still connecting`, "pool_closed");
      }

      const entry: IEntry = { endpoint, chain, bot, refs: 0, polling: false, lastUsed: Date.now() };
      this.entries.set(endpoint, entry);
      return entry;
    } catch (error) {
      chain?.delete();
      /*
       * Only a genuine connection failure is reported as one; the shutdown guard
       * above already says exactly what happened.
       */
      if (error instanceof HiveNodeError) throw error;
      throw new UpstreamError(`Cannot connect to Hive endpoint ${endpoint}`, (error as Error).message, error);
    }
  }

  /** Close the least recently used unreferenced entries until back under the cap. */
  private evict(): void {
    if (this.entries.size <= MAX_RESIDENT_ENDPOINTS) return;

    const idle = [...this.entries.values()]
      .filter((entry) => entry.refs === 0 && !this.leases.has(entry.endpoint))
      .sort((left, right) => left.lastUsed - right.lastUsed);
    for (const entry of idle) {
      if (this.entries.size <= MAX_RESIDENT_ENDPOINTS) break;
      this.close(entry);
    }
  }

  private close(entry: IEntry): void {
    /*
     * Idempotent, and keyed on identity: by the time this runs the endpoint may
     * already have been closed, or reopened as a *different* entry that must not
     * be deleted in this one's place.
     */
    if (this.entries.get(entry.endpoint) !== entry) return;
    this.entries.delete(entry.endpoint);

    entry.polling = false;
    try {
      entry.bot.delete();
    } finally {
      entry.chain.delete();
    }
  }

  /**
   * Stop every bot. Only used by the tests and by an explicit shutdown.
   *
   * Referenced entries are stopped and closed too -- a shutdown means it -- but
   * their `refs` is zeroed first, so a trigger's later `closeFunction` finds the
   * entry gone and leaves the freed bot alone.
   */
  public closeAll(): void {
    /*
     * An `open()` still in flight would otherwise publish its entry after this
     * sweep and leave a bot alive past shutdown.
     */
    this.opening.clear();
    for (const entry of [...this.entries.values()]) {
      entry.refs = 0;
      if (entry.polling) entry.bot.stop();
      this.close(entry);
    }
    this.leases.clear();
  }
}

/** Process-wide pool. n8n loads this module once, so one pool serves every node. */
export const botPool = new BotPool();

/**
 * The endpoint as this package will use and quote it.
 *
 * Userinfo is stripped. A private API node is exactly the case the `hiveApi`
 * credential exists for, and `https://user:pass@node/` is how one is usually
 * written -- but the endpoint is echoed into every output item, into two log
 * lines and into every error headline, so a credential written there would
 * travel with it into persisted execution data. Anything unparseable is left
 * alone: deciding what a valid endpoint looks like is not this function's job.
 */
export const normalizeEndpoint = (endpoint: string | undefined): string => {
  const trimmed = (endpoint ?? "").trim();
  if (trimmed === "") return DEFAULT_ENDPOINT;

  try {
    const url = new URL(trimmed);
    if (url.username === "" && url.password === "") return trimmed;

    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return trimmed;
  }
};
