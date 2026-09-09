/**
 * One WorkerBee notification -> the items a workflow execution receives.
 *
 * Two shapes, chosen per subscription:
 *
 * * `notification` -- one item carrying the whole merged payload;
 * * `operation` -- one item per individual operation, which is usually what a
 *   workflow wants, because an n8n `IF` node then tests a single operation
 *   instead of an array.
 *
 * The payload keys are WorkerBee's own (`impactedAccounts`, `whaleOperations`,
 * ...), so anything the library documents about a provider's output holds for
 * the emitted item too.
 */
import { SpecError } from "./errors";
import { isPlainRecord, normalizeNotification } from "./normalize";
import type { TJsonValue } from "./normalize";

export const EMIT_MODES = ["notification", "operation"] as const;

export type TEmitMode = (typeof EMIT_MODES)[number];

/**
 * Reject an unknown emit mode instead of falling back to one.
 *
 * `max_queue` and `overflow` are tuning knobs and degrade to a default, but the
 * mode decides the *shape* of every item a workflow receives. `build` used to
 * test only `mode === "notification"`, so `"Notification"` with a capital N read
 * as operation mode: no `payload` key, every `$json.payload.*` expression broken,
 * and nothing reported anywhere.
 */
export function emitMode(requested: string): TEmitMode {
  if ((EMIT_MODES as readonly string[]).includes(requested)) return requested as TEmitMode;
  throw new SpecError(`Unknown emit mode "${requested}"`, `It accepts: ${EMIT_MODES.join(", ")}`);
}

/** How a notification key stores its operations. */
type TGroupKind =
  /** `{ [account]: [{ operation, transaction }] }` */
  | "accountPairs"
  /** `{ [account]: [operationBody] }` -- mentions carry no transaction. */
  | "accountBodies"
  /** `{ [account]: [scalar] }` -- alarm types. */
  | "accountValues"
  /**
   * `{ [something that is not an account]: [{ operation, transaction }] }`.
   *
   * Same shape as `accountPairs`, different meaning: the key goes to `key` and
   * `account` stays null, because calling a `custom_json` app id an account name
   * is how `IF $json.account == "alice"` came to never match for that group.
   */
  | "keyedPairs"
  /** `[{ operation, transaction }]` */
  | "pairList"
  /** `[object]` */
  | "valueList";

interface IOperationGroup {
  key: string;
  kind: TGroupKind;
}

/**
 * Notification keys that carry operations.
 *
 * Provider-only keys (`accounts`, `rcAccounts`, `witnesses`, `manabarData`,
 * `feedPrice`, `*Metadata`, `transactions`) are chain *state*, not events, so
 * they are never exploded. They are not discarded either: {@link remainder}
 * gathers them onto every operation item's `context`, which is the only way a
 * workflow can still reach them -- an item that was never emitted cannot be read
 * back through `$('Hive Trigger')`.
 */
export const OPERATION_GROUPS: readonly IOperationGroup[] = [
  { key: "impactedAccounts", kind: "accountPairs" },
  { key: "votes", kind: "accountPairs" },
  { key: "posts", kind: "accountPairs" },
  { key: "comments", kind: "accountPairs" },
  /*
   * Keyed by the custom_json app id (`sm_claim_reward`, ...), not by an account:
   * see `../src/chain-observers/providers/custom-operation-provider.ts`.
   */
  { key: "customOperations", kind: "keyedPairs" },
  { key: "follows", kind: "accountPairs" },
  { key: "reblogs", kind: "accountPairs" },
  { key: "mentioned", kind: "accountBodies" },
  { key: "alarmsPerAccount", kind: "accountValues" },
  { key: "whaleOperations", kind: "pairList" },
  { key: "exchangeTransferOperations", kind: "pairList" },
  { key: "internalMarketOperations", kind: "pairList" },
  { key: "newAccounts", kind: "valueList" },
];

/** Fields every emitted item carries, whatever the mode. */
interface IEnvelope {
  kind: "notification" | "operation";
  subscriptionId: string;
  seq: number;
  emittedAt: string;
  blockNum: number | null;
  blockId: string | null;
}

export interface INotificationItem extends IEnvelope {
  kind: "notification";
  payload: Record<string, TJsonValue>;
}

export interface IOperationItem extends IEnvelope {
  kind: "operation";
  /** The notification key the operation came from (`votes`, `whaleOperations`, ...). */
  group: string;
  /** The tracked name it was grouped under; null when the group is not account-keyed. */
  account: string | null;
  /**
   * What the group was keyed by, when that is not an account.
   *
   * Only `customOperations` has one, and there it is the `custom_json` app id.
   * Absent everywhere else rather than null, so its presence is what tells a
   * workflow that `account` was never going to be filled in.
   */
  key?: string;
  operation: TJsonValue;
  transactionId: string | null;
  /**
   * Payload keys that carry no operations -- everything the providers attached,
   * plus the rest of `block`.
   *
   * Absent rather than empty when there is nothing to carry, so an `IF` can test
   * for presence the same way it does elsewhere. Shared by reference across the
   * items of one notification: repeating the whole payload instead would be
   * quadratic, since the exploded groups are themselves the large arrays.
   */
  context?: Record<string, TJsonValue>;
}

export type TEmittedItem = INotificationItem | IOperationItem;

/** Turns one normalized notification into the items a subscription emits. */
export class EventEmitter {
  private seq = 0;

  private readonly mode: TEmitMode;

  public constructor(
    private readonly subscriptionId: string,
    mode: TEmitMode,
  ) {
    this.mode = emitMode(mode);
  }

  public build(notification: object): TEmittedItem[] {
    const payload = normalizeNotification(notification);
    const [blockNum, blockId] = blockIdentity(payload);

    if (this.mode === "notification") return [this.notificationItem(payload, blockNum, blockId)];

    // Computed once and shared: see the note on `IOperationItem.context`.
    const shared = remainder(payload);

    const items = [...explode(payload)].map<IOperationItem>(([group, account, operation, transactionId, key]) => ({
      kind: "operation",
      subscriptionId: this.subscriptionId,
      seq: this.nextSeq(),
      emittedAt: now(),
      blockNum,
      blockId,
      group,
      account,
      ...(key === undefined ? {} : { key }),
      operation,
      transactionId,
      ...(shared === undefined ? {} : { context: shared }),
    }));

    /*
     * Nothing explodable in this notification (a pure provider payload, or a
     * bare onBlock). Emitting nothing would look like a dropped event, so fall
     * back to the whole payload as a single item.
     */
    return items.length > 0 ? items : [this.notificationItem(payload, blockNum, blockId)];
  }

  private nextSeq(): number {
    return ++this.seq;
  }

  private notificationItem(payload: Record<string, TJsonValue>, blockNum: number | null, blockId: string | null): INotificationItem {
    return { kind: "notification", subscriptionId: this.subscriptionId, seq: this.nextSeq(), emittedAt: now(), blockNum, blockId, payload };
  }
}

const OPERATION_KEYS = new Set(OPERATION_GROUPS.map(({ key }) => key));

/**
 * Everything in the payload that {@link explode} does not turn into items.
 *
 * `block` is included rather than skipped: the envelope lifts only its number
 * and id, so `block.timestamp`, `block.witness` and `block_data`'s transactions
 * would otherwise be the one thing operation mode could never see.
 *
 * `undefined` when nothing is left, so the field can be omitted entirely.
 */
function remainder(payload: Record<string, TJsonValue>): Record<string, TJsonValue> | undefined {
  const rest: Record<string, TJsonValue> = {};
  let found = false;

  for (const [key, value] of Object.entries(payload))
    if (!OPERATION_KEYS.has(key)) {
      rest[key] = value;
      found = true;
    }

  return found ? rest : undefined;
}

type TExploded = [group: string, account: string | null, operation: TJsonValue, transactionId: string | null, key?: string];

function* explode(payload: Record<string, TJsonValue>): Generator<TExploded> {
  for (const group of OPERATION_GROUPS) {
    const value = payload[group.key];
    if (value === undefined || value === null) continue;

    switch (group.kind) {
    case "accountPairs":
      if (!isPlainRecord(value)) continue;
      for (const [account, entries] of Object.entries(value))
        for (const entry of asArray(entries)) yield [group.key, account, operationBody(entry), transactionId(entry)];
      break;
    case "keyedPairs":
      if (!isPlainRecord(value)) continue;
      for (const [key, entries] of Object.entries(value))
        for (const entry of asArray(entries)) yield [group.key, null, operationBody(entry), transactionId(entry), key];
      break;
    case "accountBodies":
    case "accountValues":
      if (!isPlainRecord(value)) continue;
      for (const [account, entries] of Object.entries(value)) for (const entry of asArray(entries)) yield [group.key, account, entry, null];
      break;
    case "pairList":
      for (const entry of asArray(value)) yield [group.key, null, operationBody(entry), transactionId(entry)];
      break;
    case "valueList":
      for (const entry of asArray(value)) yield [group.key, null, entry, null];
      break;
    // Skip default: exhaustive over TGroupKind, deliberately
    }
  }
}

const asArray = (value: TJsonValue): TJsonValue[] => (Array.isArray(value) ? value : []);

function operationBody(pair: TJsonValue): TJsonValue {
  return isPlainRecord(pair) && "operation" in pair ? pair.operation : pair;
}

function transactionId(pair: TJsonValue): string | null {
  if (!isPlainRecord(pair)) return null;
  const transaction = pair.transaction;
  if (!isPlainRecord(transaction)) return null;
  return transaction.id === undefined || transaction.id === null ? null : String(transaction.id);
}

function blockIdentity(payload: Record<string, TJsonValue>): [number | null, string | null] {
  const block = payload.block;
  if (!isPlainRecord(block)) return [null, null];

  const rawNumber = block.number;
  const number = typeof rawNumber === "number" ? rawNumber : typeof rawNumber === "string" && /^\d+$/.test(rawNumber) ? Number(rawNumber) : null;
  const rawId = block.id;

  return [number, rawId === undefined || rawId === null ? null : String(rawId)];
}

const now = (): string => new Date().toISOString();
