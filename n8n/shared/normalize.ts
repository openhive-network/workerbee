/**
 * Turn a WorkerBee payload into JSON that n8n can consume without surprises.
 *
 * WorkerBee hands subscribers objects whose leaves are `WorkerBeeIterable`
 * containers, `Date` values, wax asset records and -- crucially -- numeric enum
 * members used as object keys. `JSON.stringify` copes with none of that well:
 *
 * * a `WorkerBeeIterable` serialises as the wrapper object it is,
 *   `{"iterable":[...]}`, so `$json.votes.alice[0]` finds nothing and every
 *   expression has to know about an implementation detail of the library;
 * * `manabarData[account][EManabarType.RC]` becomes the key `"2"`, and an
 *   `EAlarmType` becomes `3` -- unreadable in an n8n expression, and silently
 *   wrong if the enum order ever changes;
 * * Hive carries rshares, vests and RC mana past 2**53. Anything that arrives as
 *   a `bigint`, or as a number that already lost precision, is emitted as a
 *   string so an n8n expression cannot quietly round it.
 *
 * {@link normalizeJson} walks a payload once and returns only JSON builtins, so
 * the result serialises identically under any encoder.
 */

/** Any JSON value: object, array, string, number, boolean or null. */
export type TJsonValue = null | boolean | number | string | TJsonValue[] | { [key: string]: TJsonValue };

/**
 * Readable names for the numeric enums WorkerBee puts into payloads.
 *
 * TypeScript enums have no runtime reflection worth the name -- `EManabarType`
 * compiles to a plain object and `EAlarmType` is a `const` object of numbers --
 * so the mapping is spelled out here and asserted against the library's own
 * enums in `tests/normalize.test.mjs`.
 */
export const MANABAR_TYPE_NAMES: Readonly<Record<string, string>> = { 0: "UPVOTE", 1: "DOWNVOTE", 2: "RC" };

export const ALARM_TYPE_NAMES: Readonly<Record<string, string>> = {
  0: "LEGACY_RECOVERY_ACCOUNT_SET",
  1: "GOVERNANCE_VOTE_EXPIRATION_SOON",
  2: "GOVERNANCE_VOTE_EXPIRED",
  3: "RECOVERY_ACCOUNT_IS_CHANGING",
  4: "DECLINING_VOTING_RIGHTS",
};

const isIterable = (value: object): value is Iterable<unknown> => typeof (value as Iterable<unknown>)[Symbol.iterator] === "function";

/**
 * Recursively convert `value` into JSON builtins that n8n reads cleanly.
 *
 * `undefined` members are dropped rather than emitted as `null`, so an n8n `IF`
 * node can test key presence meaningfully.
 */
export function normalizeJson(value: unknown): TJsonValue {
  return normalizeInner(value, new WeakSet());
}

function normalizeInner(value: unknown, seen: WeakSet<object>): TJsonValue {
  if (value === null || value === undefined) return null;

  switch (typeof value) {
  case "boolean":
  case "string":
    return value;
  case "number":
    /*
     * NaN and Infinity are not JSON, and returning them unchanged broke this
     * function's own contract: `JSON.stringify` turns both into `null`, which
     * an IF node cannot tell apart from a key the provider did not populate.
     */
    if (!Number.isFinite(value)) return String(value);
    /*
     * A number this large already lost precision when it was parsed, but
     * emitting it as a string at least stops n8n from losing more. It has to be
     * the digits, not `String(1.2345e21)` -- exponential notation makes
     * `BigInt($json.rshares)` throw and breaks any decimal comparison.
     */
    if (Math.abs(value) <= Number.MAX_SAFE_INTEGER) return value;
    return Number.isInteger(value) ? BigInt(value).toString() : String(value);
  case "bigint":
    return value.toString();
  case "function":
    return String(value);
  case "symbol":
    /*
     * The library tags known exchanges with symbols; the description is the
     * exchange name, and `String(sym)` would wrap it in "Symbol(...)" that every
     * n8n expression would then have to match verbatim.
     */
    return value.description ?? String(value);
  default:
    break;
  }

  if (value instanceof Date) return value.toISOString();
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("hex");
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString("hex");

  /*
   * Everything below recurses, so a cycle would overflow the stack. The return
   * type promises a finite JSON value and could not deliver one: a self
   * reference, or a `toJSON()` returning `this`, threw a RangeError that
   * `EventStream.push` swallows into the error counter -- so the whole
   * notification produced no items at all, with `seq` showing no gap and
   * `dropped` not moving. Chain payloads are acyclic today; this makes that a
   * property of the function rather than of the data.
   *
   * `seen` is the path from the root, not everything visited: an object that
   * legitimately appears twice in different branches is serialised twice, and
   * only an ancestor of itself becomes null.
   */
  if (seen.has(value)) return null;
  seen.add(value);
  try {
    return normalizeContainer(value, seen);
  } finally {
    seen.delete(value);
  }
}

function normalizeContainer(value: object, seen: WeakSet<object>): TJsonValue {
  if (Array.isArray(value)) return value.map((element) => normalizeInner(element, seen));
  if (value instanceof Map) return normalizeEntries(value.entries(), seen);
  if (value instanceof Set) return [...value].map((element) => normalizeInner(element, seen));

  /*
   * WorkerBeeIterable and anything else iterable: the elements are the content,
   * and the container itself has nothing worth serialising.
   */
  if (isIterable(value)) return [...value].map((element) => normalizeInner(element, seen));

  if (typeof (value as { toJSON?: unknown }).toJSON === "function") return normalizeInner((value as { toJSON(): unknown }).toJSON(), seen);

  return normalizeEntries(Object.entries(value as Record<string, unknown>), seen);
}

function normalizeEntries(entries: Iterable<[unknown, unknown]>, seen: WeakSet<object>): Record<string, TJsonValue> {
  const result: Record<string, TJsonValue> = {};
  for (const [key, entryValue] of entries) if (entryValue !== undefined) result[String(key)] = normalizeInner(entryValue, seen);
  return result;
}

/**
 * Normalise a payload object, returning a plain JSON object.
 *
 * `Record<string, unknown>` rather than `object`, because an array is an
 * `object` too: a notification that arrived as one used to normalise to `[...]`,
 * fail the plain-record test, and be emitted as an empty payload -- no error, no
 * counter, no log.
 */
function normalizeMapping(value: Record<string, unknown>): Record<string, TJsonValue> {
  const normalized = normalizeJson(value);
  if (!isPlainRecord(normalized)) throw new TypeError(`A notification must be an object, got ${Array.isArray(value) ? "an array" : typeof value}`);
  return normalized;
}

export const isPlainRecord = (value: TJsonValue): value is Record<string, TJsonValue> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Replace the numeric enum spellings WorkerBee leaves in a notification.
 *
 * Runs after {@link normalizeJson}, on the two payload keys that carry them:
 * `manabarData` is keyed by `EManabarType` one level below the account name, and
 * `alarmsPerAccount` holds `EAlarmType` values. Both are rewritten to the enum's
 * own member name, which is what an n8n expression can be written against.
 */
export function normalizeNotification(notification: object): Record<string, TJsonValue> {
  const payload = normalizeMapping(notification as Record<string, unknown>);

  const manabar = payload.manabarData;
  if (isPlainRecord(manabar))
    payload.manabarData = mapValues(manabar, (perAccount) => (isPlainRecord(perAccount) ? renameKeys(perAccount, MANABAR_TYPE_NAMES) : perAccount));

  const alarms = payload.alarmsPerAccount;
  if (isPlainRecord(alarms))
    payload.alarmsPerAccount = mapValues(alarms, (perAccount) =>
      Array.isArray(perAccount) ? perAccount.map((alarm) => named(ALARM_TYPE_NAMES, String(alarm)) ?? alarm) : perAccount,
    );

  return payload;
}

function mapValues(record: Record<string, TJsonValue>, transform: (value: TJsonValue) => TJsonValue): Record<string, TJsonValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, transform(value)]));
}

function renameKeys(record: Record<string, TJsonValue>, names: Readonly<Record<string, string>>): Record<string, TJsonValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [named(names, key) ?? key, value]));
}

/** Own properties only: a key of "constructor" must fall through, not return a function. */
const named = (names: Readonly<Record<string, string>>, key: string): string | undefined => (Object.hasOwn(names, key) ? names[key] : undefined);
