/**
 * Declarative event/provider specs that compile into a WorkerBee observer chain.
 *
 * Every observer this package exposes is one entry in {@link EVENTS} or
 * {@link PROVIDERS}. That buys three things at once:
 *
 * * the node UI is *generated* -- dropdowns, parameter names, types and defaults
 *   all come from this table, so a new observer is one entry, not a form edit;
 * * a request is validated against the entry before anything touches the chain,
 *   so a typo becomes a precise error instead of a runtime `TypeError`;
 * * compilation is a direct method call on a typed chain, never
 *   `queen[userSuppliedName](...)`.
 *
 * Account lists are `names` (non-empty) on purpose. WorkerBee backs an empty
 * list with an empty set, which matches nothing -- an empty list would silently
 * produce a subscription that never fires.
 *
 * The wire tags are snake_case (`accounts_balance_change`, `min_count`). They
 * are the stable public contract: exported workflow JSON, the catalog and the
 * `Raw JSON` spec field all speak them, and they render as readable labels in
 * the n8n dropdowns.
 */
import type { IWorkerBee } from "../../workerbee/index";
import type { asset, EManabarType } from "./wax-types";


/** The live QueenBee type, reached without depending on it being exported by name. */
export type TQueenBee = IWorkerBee["observe"];

/**
 * The slice of `QueenBee` this package drives.
 *
 * Declared structurally and pinned by {@link conformsToQueenBee} below, so that
 * renaming or re-signing any observer in `src/queen.ts` breaks *this* build
 * rather than silently producing a node that throws at runtime.
 *
 * One gap the type system cannot close: `EManabarType` is a numeric enum, and
 * TypeScript accepts a `number` where one is expected, so swapping the first two
 * arguments of `onAccountsManabarPercent` would satisfy this interface and go
 * wrong only at runtime. `tests/catalog.test.mjs` pins that one order by calling
 * the real chain and reading back the filter it built.
 */
export interface IObserverChain {
  readonly and: IObserverChain;
  subscribe(observer: { next?: (data: object) => void; error?: (error: Error) => void; complete?: () => void }): { unsubscribe(): void };
  onBlock(): IObserverChain;
  onBlockNumber(number: number): IObserverChain;
  onTransactionIds(...transactionIds: string[]): IObserverChain;
  onImpactedAccounts(...accounts: string[]): IObserverChain;
  onAccountsBalanceChange(includeInternalTransfers: boolean, ...accounts: string[]): IObserverChain;
  onAccountsMetadataChange(...accounts: string[]): IObserverChain;
  onAccountsFullManabar(manabarType: EManabarType, ...accounts: string[]): IObserverChain;
  onAccountsManabarPercent(manabarType: EManabarType, percent: number, ...accounts: string[]): IObserverChain;
  onNewAccount(): IObserverChain;
  onAlarm(...watchAccounts: string[]): IObserverChain;
  onVotes(...voters: string[]): IObserverChain;
  onPosts(...authors: string[]): IObserverChain;
  onComments(...authors: string[]): IObserverChain;
  onMention(...mentionedAccounts: string[]): IObserverChain;
  onReblog(...rebloggers: string[]): IObserverChain;
  onFollow(...followers: string[]): IObserverChain;
  onCustomOperation(...ids: string[]): IObserverChain;
  onPostsIncomingPayout(relativeTimeMs: number | string, ...authors: string[]): IObserverChain;
  onCommentsIncomingPayout(relativeTimeMs: number | string, ...authors: string[]): IObserverChain;
  onFeedPriceChange(percent: number): IObserverChain;
  onFeedPriceNoChange(lastHoursCount: number): IObserverChain;
  onWhaleAlert(threshold: asset): IObserverChain;
  onExchangeTransfer(): IObserverChain;
  onInternalMarketOperation(): IObserverChain;
  onWitnessesMissedBlocks(missedBlocksMinCount: number, ...witnesses: string[]): IObserverChain;
  provideAccounts(...accounts: string[]): IObserverChain;
  provideWitnesses(...witnesses: string[]): IObserverChain;
  provideRcAccounts(...accounts: string[]): IObserverChain;
  provideBlockHeaderData(): IObserverChain;
  provideBlockData(): IObserverChain;
  provideFeedPriceData(): IObserverChain;
  provideManabarData(manabarType: EManabarType, ...accounts: string[]): IObserverChain;
}

/** Compile-time only: a real QueenBee must satisfy {@link IObserverChain}. */
export const conformsToQueenBee = (queen: TQueenBee): IObserverChain => queen;

/**
 * `EManabarType` is an ambient enum in wax, and this package never loads wax into
 * its own (CommonJS) module graph -- so the three members are spelled out and
 * asserted against the real enum in `tests/catalog.test.mjs`.
 */
export const MANABAR_KINDS = { upvote: 0, downvote: 1, rc: 2 } as const;

export type TManabarKind = keyof typeof MANABAR_KINDS;

// --------------------------------------------------------------------- fields

/** How one parameter is spelled, validated and rendered in the catalog. */
export type TFieldType =
  /** Hive account names, checked for the shape the chain accepts. */
  | { kind: "names" }
  /** A list of free-form strings: transaction ids, custom_json ids. */
  | { kind: "strings" }
  | { kind: "int"; min?: number; max?: number }
  | { kind: "float"; min?: number; max?: number; exclusiveMin?: number }
  | { kind: "bool" }
  | { kind: "relativeTime" }
  | { kind: "manabar" }
  | { kind: "asset" };

export interface IFieldDescriptor {
  name: string;
  type: TFieldType;
  /** Absent means required. */
  default?: string | number | boolean | string[];
  description: string;
}

/** Validated parameter access handed to {@link ISpecDescriptor.apply}. */
export interface IParams {
  names(name: string): string[];
  strings(name: string): string[];
  int(name: string): number;
  float(name: string): number;
  bool(name: string): boolean;
  relativeTime(name: string): number | string;
  manabar(name: string): EManabarType;
  asset(name: string): asset;
}

export interface ISpecDescriptor {
  tag: string;
  kind: "event" | "provider";
  summary: string;
  fields: IFieldDescriptor[];
  apply(chain: IObserverChain, params: IParams): IObserverChain;
}

const ACCOUNTS: IFieldDescriptor = { name: "accounts", type: { kind: "names" }, description: "Hive account names to watch" };
const MANABAR: IFieldDescriptor = {
  name: "manabar",
  type: { kind: "manabar" },
  default: "upvote",
  description: "Which manabar to read: upvote, downvote or rc",
};

// --------------------------------------------------------------------- events

export const EVENTS: ISpecDescriptor[] = [
  {
    tag: "block",
    kind: "event",
    summary: "Fires once per new Hive block.",
    fields: [],
    apply: (chain) => chain.onBlock(),
  },
  {
    tag: "block_number",
    kind: "event",
    summary: "Fires once, when the chain reaches the given block number.",
    fields: [{ name: "block_number", type: { kind: "int", min: 1 }, description: "The block number to wait for" }],
    apply: (chain, params) => chain.onBlockNumber(params.int("block_number")),
  },
  {
    tag: "transaction_ids",
    kind: "event",
    summary: "Fires when one of the given transaction ids is seen in a block.",
    fields: [{ name: "transaction_ids", type: { kind: "strings" }, description: "Transaction ids to watch for" }],
    apply: (chain, params) => chain.onTransactionIds(...params.strings("transaction_ids")),
  },
  {
    tag: "impacted_accounts",
    kind: "event",
    summary: "Fires on every operation that impacts one of the accounts.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.onImpactedAccounts(...params.names("accounts")),
  },
  {
    tag: "accounts_balance_change",
    kind: "event",
    summary: "Fires when a tracked account's HIVE/HBD/HP balance changes.",
    fields: [
      ACCOUNTS,
      {
        name: "include_internal_transfers",
        type: { kind: "bool" },
        default: false,
        description: "Also fire on vesting/savings movements that do not leave the account",
      },
    ],
    apply: (chain, params) => chain.onAccountsBalanceChange(params.bool("include_internal_transfers"), ...params.names("accounts")),
  },
  {
    tag: "accounts_metadata_change",
    kind: "event",
    summary: "Fires when a tracked account's json_metadata or posting_json_metadata changes.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.onAccountsMetadataChange(...params.names("accounts")),
  },
  {
    tag: "accounts_full_manabar",
    kind: "event",
    summary: "Fires when a tracked account's manabar reaches 98% (WorkerBee's 'full').",
    fields: [ACCOUNTS, MANABAR],
    apply: (chain, params) => chain.onAccountsFullManabar(params.manabar("manabar"), ...params.names("accounts")),
  },
  {
    tag: "accounts_manabar_percent",
    kind: "event",
    summary: "Fires when a tracked account's manabar reaches the given percent.",
    fields: [
      ACCOUNTS,
      { name: "percent", type: { kind: "float", min: 0, max: 100 }, description: "Manabar percentage that triggers the event" },
      MANABAR,
    ],
    apply: (chain, params) => chain.onAccountsManabarPercent(params.manabar("manabar"), params.float("percent"), ...params.names("accounts")),
  },
  {
    tag: "new_account",
    kind: "event",
    summary: "Fires when any new Hive account is created.",
    fields: [],
    apply: (chain) => chain.onNewAccount(),
  },
  {
    tag: "alarm",
    kind: "event",
    summary: "Fires on recovery-account and governance-vote alarms for the accounts.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.onAlarm(...params.names("accounts")),
  },
  {
    tag: "votes",
    kind: "event",
    summary: "Fires when one of the voters casts a vote.",
    fields: [{ name: "voters", type: { kind: "names" }, description: "Accounts whose votes to watch" }],
    apply: (chain, params) => chain.onVotes(...params.names("voters")),
  },
  {
    tag: "posts",
    kind: "event",
    summary: "Fires when one of the authors publishes a top-level post.",
    fields: [{ name: "authors", type: { kind: "names" }, description: "Authors to watch" }],
    apply: (chain, params) => chain.onPosts(...params.names("authors")),
  },
  {
    tag: "comments",
    kind: "event",
    summary: "Fires when one of the authors publishes a reply.",
    fields: [{ name: "authors", type: { kind: "names" }, description: "Authors to watch" }],
    apply: (chain, params) => chain.onComments(...params.names("authors")),
  },
  {
    tag: "mention",
    kind: "event",
    summary: "Fires when a post mentions one of the accounts.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.onMention(...params.names("accounts")),
  },
  {
    tag: "reblog",
    kind: "event",
    summary: "Fires when one of the accounts reblogs a post.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.onReblog(...params.names("accounts")),
  },
  {
    tag: "follow",
    kind: "event",
    summary: "Fires when one of the accounts follows/unfollows somebody.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.onFollow(...params.names("accounts")),
  },
  {
    tag: "custom_operation",
    kind: "event",
    summary: "Fires on custom_json operations carrying one of the ids (e.g. 'splinterlands').",
    fields: [{ name: "ids", type: { kind: "strings" }, description: "custom_json ids to watch" }],
    apply: (chain, params) => chain.onCustomOperation(...params.strings("ids")),
  },
  {
    tag: "posts_incoming_payout",
    kind: "event",
    summary: "Fires when a tracked author's post is within the payout window.",
    fields: [
      { name: "authors", type: { kind: "names" }, description: "Authors to watch" },
      {
        name: "within",
        type: { kind: "relativeTime" },
        default: "-1h",
        description: "How close to payout: milliseconds, or a WorkerBee relative offset such as -1h",
      },
    ],
    apply: (chain, params) => chain.onPostsIncomingPayout(params.relativeTime("within"), ...params.names("authors")),
  },
  {
    tag: "comments_incoming_payout",
    kind: "event",
    summary: "Fires when a tracked author's comment is within the payout window.",
    fields: [
      { name: "authors", type: { kind: "names" }, description: "Authors to watch" },
      {
        name: "within",
        type: { kind: "relativeTime" },
        default: "-1h",
        description: "How close to payout: milliseconds, or a WorkerBee relative offset such as -1h",
      },
    ],
    apply: (chain, params) => chain.onCommentsIncomingPayout(params.relativeTime("within"), ...params.names("authors")),
  },
  {
    tag: "feed_price_change",
    kind: "event",
    summary: "Fires when the median HIVE/HBD feed price moves by at least percent.",
    fields: [{ name: "percent", type: { kind: "float", min: 0, max: 100 }, description: "Minimum move, in percent" }],
    apply: (chain, params) => chain.onFeedPriceChange(params.float("percent")),
  },
  {
    tag: "feed_price_no_change",
    kind: "event",
    summary: "Fires when the median feed price has not moved for the given number of hours.",
    fields: [
      { name: "last_hours_count", type: { kind: "float", exclusiveMin: 0 }, default: 24, description: "Window of flat price, in hours" },
    ],
    apply: (chain, params) => chain.onFeedPriceNoChange(params.float("last_hours_count")),
  },
  {
    tag: "whale_alert",
    kind: "event",
    summary: "Fires on transfers larger than the given NAI asset threshold.",
    fields: [
      {
        name: "asset",
        type: { kind: "asset" },
        description: 'NAI asset threshold, e.g. {"amount":"100000","precision":3,"nai":"@@000000021"} for 100 000 HIVE (@@000000013 is HBD)',
      },
    ],
    apply: (chain, params) => chain.onWhaleAlert(params.asset("asset")),
  },
  {
    tag: "exchange_transfer",
    kind: "event",
    summary: "Fires on transfers involving a known exchange account.",
    fields: [],
    apply: (chain) => chain.onExchangeTransfer(),
  },
  {
    tag: "internal_market_operation",
    kind: "event",
    summary: "Fires on internal-market limit order create/cancel/fill operations.",
    fields: [],
    apply: (chain) => chain.onInternalMarketOperation(),
  },
  {
    tag: "witnesses_missed_blocks",
    kind: "event",
    summary: "Fires when a tracked witness reaches the missed-block threshold.",
    fields: [
      { name: "witnesses", type: { kind: "names" }, description: "Witness accounts to watch" },
      { name: "min_count", type: { kind: "int", min: 1 }, default: 1, description: "Missed blocks that trigger the event" },
    ],
    apply: (chain, params) => chain.onWitnessesMissedBlocks(params.int("min_count"), ...params.names("witnesses")),
  },
];

// ------------------------------------------------------------------ providers

export const PROVIDERS: ISpecDescriptor[] = [
  {
    tag: "accounts",
    kind: "provider",
    summary: "Adds the 'accounts' key with balances, manabars and metadata.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.provideAccounts(...params.names("accounts")),
  },
  {
    tag: "witnesses",
    kind: "provider",
    summary: "Adds the 'witnesses' key with version and missed-block counters.",
    fields: [{ name: "witnesses", type: { kind: "names" }, description: "Witness accounts to attach" }],
    apply: (chain, params) => chain.provideWitnesses(...params.names("witnesses")),
  },
  {
    tag: "rc_accounts",
    kind: "provider",
    summary: "Adds the 'rcAccounts' key with RC manabars.",
    fields: [ACCOUNTS],
    apply: (chain, params) => chain.provideRcAccounts(...params.names("accounts")),
  },
  {
    tag: "block_header_data",
    kind: "provider",
    summary: "Adds the 'block' key with number, id, timestamp and witness.",
    fields: [],
    apply: (chain) => chain.provideBlockHeaderData(),
  },
  {
    tag: "block_data",
    kind: "provider",
    summary: "Adds the 'block' key with every transaction in the block.",
    fields: [],
    apply: (chain) => chain.provideBlockData(),
  },
  {
    tag: "feed_price_data",
    kind: "provider",
    summary: "Adds the 'feedPrice' key with current median/min/max history.",
    fields: [],
    apply: (chain) => chain.provideFeedPriceData(),
  },
  {
    tag: "manabar_data",
    kind: "provider",
    summary: "Adds the 'manabarData' key with current/max/percent per account.",
    fields: [ACCOUNTS, MANABAR],
    apply: (chain, params) => chain.provideManabarData(params.manabar("manabar"), ...params.names("accounts")),
  },
];

const byTag = (entries: ISpecDescriptor[]): ReadonlyMap<string, ISpecDescriptor> => new Map(entries.map((entry) => [entry.tag, entry]));

export const EVENTS_BY_TAG = byTag(EVENTS);
export const PROVIDERS_BY_TAG = byTag(PROVIDERS);
