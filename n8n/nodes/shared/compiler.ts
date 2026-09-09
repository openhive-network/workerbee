/**
 * Compile a declarative subscription spec into a live WorkerBee observer chain.
 *
 * Two steps, both of which can fail loudly and precisely:
 *
 * * {@link parseParams} validates one event's parameters against its descriptor
 *   -- unknown name, missing required, wrong type, out of range;
 * * {@link compileSpec} walks the spec's AND-of-OR groups and calls the
 *   descriptor's own `apply`, so a caller-supplied string is never used to look
 *   up a method.
 *
 * Values are coerced leniently on the way in ("12" becomes 12, "true" becomes
 * true), because they reach us either as JSON from the Raw JSON field or as
 * strings typed into the visual builder, and both must behave the same.
 */
import { SpecError } from "./errors";
import { EVENTS_BY_TAG, MANABAR_KINDS, PROVIDERS_BY_TAG } from "./events";
import type { IFieldDescriptor, IObserverChain, IParams, ISpecDescriptor, TFieldType, TManabarKind } from "./events";
import type { asset, EManabarType } from "./wax-types";

/** One entry of `match` or `provide`: the tag plus its parameters. */
export type TSpecEntry = Record<string, unknown>;

export interface ISubscriptionSpec {
  /** AND of OR-groups: `[[a, b], [c]]` means `(a OR b) AND c`. */
  match: TSpecEntry[][];
  provide?: TSpecEntry[];
  mode?: string;
  max_queue?: number;
  overflow?: string;
  endpoint?: string;
}

/** Keys of a spec entry that name the descriptor rather than one of its fields. */
const TAG_KEYS = ["event", "provide"] as const;

/** Every key a subscription spec may carry, matching `SubscriptionSpec` in the JSON Schema. */
const SPEC_KEYS = ["match", "provide", "mode", "max_queue", "overflow", "endpoint"] as const;

/**
 * The one shape check a spec must pass, wherever it came from.
 *
 * Shared with `spec.ts` so the visual builder and the Raw JSON field cannot
 * disagree about what counts as a usable spec. Unknown top-level keys are
 * rejected for the same reason unknown *parameter* names are: the schema says
 * `additionalProperties: false`, and a spec whose `provide` was typed `provides`
 * is silently a spec with no providers at all.
 */
export function requireMatch(spec: unknown): asserts spec is ISubscriptionSpec {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) throw new SpecError("A spec must be a JSON object", `Got ${JSON.stringify(spec)}`);

  const candidate = spec as Record<string, unknown>;

  const unknown = Object.keys(candidate).filter((key) => !(SPEC_KEYS as readonly string[]).includes(key));
  if (unknown.length > 0) throw new SpecError(`A spec has no "${unknown[0]}" setting`, `It accepts: ${SPEC_KEYS.join(", ")}`);

  const match = candidate.match;
  if (!Array.isArray(match) || match.length === 0) throw new SpecError('A spec needs a non-empty "match" array of arrays');

  /*
   * Checked, not assumed. This used to be typed `ISubscriptionSpec` and take the
   * caller's word for it, so `{"match":[[null]]}` reached `resolve()` and came
   * back as a bare TypeError with no `code` -- breaking the promise errors.ts
   * makes, that every error from this package carries one an Error Trigger can
   * branch on.
   */
  match.forEach((group, index) => {
    if (!Array.isArray(group))
      throw new SpecError(`Match group #${index + 1} must be an array of events`, 'The outer array is AND, the inner one OR: [[{"event":"posts"}]].');
    group.forEach((entry, position) => requireEntry(entry, `Event #${position + 1} of match group #${index + 1}`));
  });

  const provide = candidate.provide;
  if (provide !== undefined) {
    if (!Array.isArray(provide)) throw new SpecError('A spec\'s "provide" must be an array of providers', `Got ${JSON.stringify(provide)}`);
    provide.forEach((entry, index) => requireEntry(entry, `Provider #${index + 1}`));
  }
}

function requireEntry(entry: unknown, where: string): void {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw new SpecError(`${where} must be an object`, `Got ${JSON.stringify(entry)}`);
}

export function compileSpec(chain: IObserverChain, spec: ISubscriptionSpec): IObserverChain {
  requireMatch(spec);

  let current = chain;
  spec.match.forEach((group, index) => {
    if (!Array.isArray(group) || group.length === 0) throw new SpecError(`Match group #${index + 1} is empty; every group needs at least one event`);
    /*
     * Entries inside a group are OR-ed (WorkerBee's implicit default); a new
     * group starts a fresh AND operand.
     */
    if (index > 0) current = current.and;
    for (const entry of group) current = applyEntry(current, entry, "event");
  });

  for (const entry of spec.provide ?? []) current = applyEntry(current, entry, "provider");

  return current;
}

function applyEntry(chain: IObserverChain, entry: TSpecEntry, kind: "event" | "provider"): IObserverChain {
  const descriptor = resolve(entry, kind);
  const params = parseParams(descriptor, entry);
  try {
    return descriptor.apply(chain, params);
  } catch (error) {
    /*
     * WorkerBee's own rejections (an unusable filter combination, a wax
     * validation failure) land here; either way the caller sent something the
     * library will not accept.
     */
    throw new SpecError(`Cannot apply ${kind} "${descriptor.tag}"`, (error as Error).message, error);
  }
}

function resolve(entry: TSpecEntry, kind: "event" | "provider"): ISpecDescriptor {
  const table = kind === "event" ? EVENTS_BY_TAG : PROVIDERS_BY_TAG;
  const tagKey = kind === "event" ? "event" : "provide";
  const tag = entry[tagKey];

  if (typeof tag !== "string" || tag === "")
    throw new SpecError(`Every ${kind} entry needs a "${tagKey}" name`, `Known ${kind}s: ${[...table.keys()].sort().join(", ")}`);

  const descriptor = table.get(tag);
  if (descriptor === undefined) throw new SpecError(`Unknown ${kind} "${tag}"`, `Known ${kind}s: ${[...table.keys()].sort().join(", ")}`);

  return descriptor;
}

/**
 * Validate and coerce one entry's parameters, then hand them back as typed
 * accessors. Unknown parameter names are rejected rather than ignored, because
 * a silently dropped `authors` is a subscription that never fires.
 */
export function parseParams(descriptor: ISpecDescriptor, entry: TSpecEntry): IParams {
  const known = new Map(descriptor.fields.map((field) => [field.name, field]));

  for (const key of Object.keys(entry)) {
    if ((TAG_KEYS as readonly string[]).includes(key) || known.has(key)) continue;
    const accepted = descriptor.fields.map((field) => field.name).join(", ") || "(none)";
    throw new SpecError(`"${descriptor.tag}" has no parameter "${key}"`, `It accepts: ${accepted}`);
  }

  const values = new Map<string, unknown>();
  for (const field of descriptor.fields) {
    const raw = entry[field.name];
    if (raw === undefined || raw === "") {
      if (field.default === undefined) throw new SpecError(`"${descriptor.tag}" is missing required parameter "${field.name}"`, field.description);
      values.set(field.name, coerce(descriptor, field, field.default));
      continue;
    }
    values.set(field.name, coerce(descriptor, field, raw));
  }

  /**
   * One accessor, checked twice.
   *
   * All nine used to be the same `values.get(name) as T`, which made the
   * declared return types decoration. Two things got through: an unknown name
   * returned `undefined` typed as, say, `number`, so a single-character typo in
   * a field name inside `events.ts` compiled to `onFeedPriceChange(undefined)`
   * and a subscription that never fired; and the wrong accessor for a field's
   * kind -- `params.int("authors")` -- returned the array typed as a number and
   * handed it to a numeric filter. Both were silent.
   *
   * `tests/catalog.test.mjs` could not catch either, because its `stubParams`
   * aliased the nine accessors exactly the same way.
   */
  const read = <T>(name: string, kinds: TFieldType["kind"][]): T => {
    const field = known.get(name);
    if (field === undefined) {
      const accepted = descriptor.fields.map((each) => each.name).join(", ") || "(none)";
      throw new SpecError(`"${descriptor.tag}" reads a parameter "${name}" it does not declare`, `It declares: ${accepted}`);
    }
    if (!kinds.includes(field.type.kind))
      throw new SpecError(
        `"${descriptor.tag}" reads "${name}" as ${kinds.join(" or ")}, but it is declared ${field.type.kind}`,
        "This is a mistake in the event registry, not in the spec.",
      );

    return values.get(name) as T;
  };

  return {
    names: (name) => read<string[]>(name, ["names"]),
    strings: (name) => read<string[]>(name, ["strings"]),
    int: (name) => read<number>(name, ["int"]),
    float: (name) => read<number>(name, ["float"]),
    bool: (name) => read<boolean>(name, ["bool"]),
    relativeTime: (name) => read<number | string>(name, ["relativeTime"]),
    manabar: (name) => read<EManabarType>(name, ["manabar"]),
    asset: (name) => read<asset>(name, ["asset"]),
  };
}

function coerce(descriptor: ISpecDescriptor, field: IFieldDescriptor, raw: unknown): unknown {
  const where = `Parameter "${field.name}" of "${descriptor.tag}"`;
  const type = field.type;

  switch (type.kind) {
  case "names": {
    const list = toStringList(raw, where);
    if (list.length === 0) throw new SpecError(`${where} must list at least one name`, "An empty list matches nothing, so the subscription would never fire.");

    /*
     * Account names are matched by set membership, so anything the chain
     * could not have issued simply never matches: `authors: "alice bob"`
     * (a space instead of a comma) became one name nobody has, and the
     * subscription was indistinguishable from a quiet chain.
     */
    for (const name of list)
      if (!ACCOUNT_NAME.test(name))
        throw new SpecError(
          `${where}: "${name}" is not a Hive account name`,
          "Lowercase letters, digits, dots and hyphens, 3 to 16 characters. Separate several with commas.",
        );

    return list;
  }
  case "strings":
    return toStringList(raw, where);
  case "int": {
    const value = toNumber(raw, where);
    if (!Number.isInteger(value)) throw new SpecError(`${where} must be a whole number, got ${JSON.stringify(raw)}`);
    return checkRange(value, type, where);
  }
  case "float":
    return checkRange(toNumber(raw, where), type, where);
  case "bool": {
    /*
     * Strict both ways. The old test only matched the true words, so "ture"
     * and "enabled" quietly meant false while the number 1 threw -- the exact
     * opposite of every other type in this switch.
     */
    if (typeof raw === "boolean") return raw;
    const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim().toLowerCase() : undefined;
    if (text !== undefined && ["true", "1", "yes", "on"].includes(text)) return true;
    if (text !== undefined && ["false", "0", "no", "off"].includes(text)) return false;
    throw new SpecError(`${where} must be true or false, got ${JSON.stringify(raw)}`);
  }
  case "relativeTime": {
    /*
     * Milliseconds, or a WorkerBee relative offset such as "-1h". Take the
     * numeric reading only when the text really is a number, so "-1h" survives.
     */
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) throw new SpecError(`${where} must be a number of milliseconds or an offset like "-1h", got ${JSON.stringify(raw)}`);
      return raw;
    }

    const text = String(raw).trim();
    if (isNumeric(text)) return Number(text);
    if (RELATIVE_OFFSET.test(text)) return text;

    /*
     * Anything else goes to wax's `dateFromString`, which is `new Date(s+"Z")`
     * and does not throw: an unparseable string becomes an Invalid Date, whose
     * getTime() is NaN, and every comparison against NaN is false. So "1h" --
     * the obvious thing to type under a label reading "How close to payout" --
     * used to compile into a subscription that never fired, with no error
     * anywhere. Only "-1h" ever worked.
     */
    if (!Number.isNaN(Date.parse(text)) || !Number.isNaN(Date.parse(`${text}Z`))) return text;

    throw new SpecError(
      `${where} must be milliseconds, an offset like "-1h", or a timestamp, got ${JSON.stringify(raw)}`,
      "An offset counts back from now and needs the leading minus: -30s, -15m, -1h, -7d.",
    );
  }
  case "manabar": {
    const kind = String(raw).trim().toLowerCase();
    if (!(kind in MANABAR_KINDS))
      throw new SpecError(`${where} must be one of ${Object.keys(MANABAR_KINDS).join(", ")}, got ${JSON.stringify(raw)}`);
    return MANABAR_KINDS[kind as TManabarKind] as EManabarType;
  }
  case "asset":
    return toAsset(raw, where);
  // Skip default: exhaustive over TFieldType, deliberately
  }
}

function checkRange(value: number, type: Extract<TFieldType, { kind: "int" | "float" }>, where: string): number {
  const min = "min" in type ? type.min : undefined;
  const max = "max" in type ? type.max : undefined;
  const exclusiveMin = "exclusiveMin" in type ? type.exclusiveMin : undefined;

  if (min !== undefined && value < min) throw new SpecError(`${where} must be at least ${min}, got ${value}`);
  if (max !== undefined && value > max) throw new SpecError(`${where} must be at most ${max}, got ${value}`);
  if (exclusiveMin !== undefined && value <= exclusiveMin) throw new SpecError(`${where} must be greater than ${exclusiveMin}, got ${value}`);

  return value;
}

function toStringList(raw: unknown, where: string): string[] {
  /*
   * A single comma-separated string is what the visual builder produces; an
   * array is what the Raw JSON field produces. Both mean the same thing.
   *
   * Anything else is refused rather than stringified: `String(null)` is "null",
   * a perfectly valid-looking Hive account name, so `{"authors": null}` used to
   * compile into a subscription that watched an account called "null" and simply
   * never fired -- indistinguishable from a quiet chain.
   */
  if (typeof raw !== "string" && !Array.isArray(raw)) throw new SpecError(`${where} must be a list or a comma-separated string, got ${JSON.stringify(raw)}`);

  const parts = Array.isArray(raw) ? raw : raw.split(",");
  return parts
    .map((part) => {
      if (typeof part !== "string" && typeof part !== "number")
        throw new SpecError(`${where} must contain only names, got ${JSON.stringify(part)} in the list`);
      return String(part).trim();
    })
    .filter((part) => part !== "");
}

function toNumber(raw: unknown, where: string): number {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw new SpecError(`${where} must be a number, got ${JSON.stringify(raw)}`);
    return raw;
  }

  /*
   * Only a string may be parsed. `Number("")` is 0 and `String([])` is "", so a
   * lone space or an empty array used to arrive as a perfectly valid 0 -- which
   * for `percent` means "fires on every block" rather than an error.
   */
  if (typeof raw !== "string") throw new SpecError(`${where} must be a number, got ${JSON.stringify(raw)}`);

  const text = raw.trim();
  if (!isNumeric(text)) throw new SpecError(`${where} must be a number, got ${JSON.stringify(raw)}`);
  return Number(text);
}

function toAsset(raw: unknown, where: string): asset {
  const value = typeof raw === "string" ? parseJson(raw, where) : raw;
  if (value === null || typeof value !== "object") throw new SpecError(`${where} must be a NAI asset object`);

  const candidate = value as Record<string, unknown>;
  const missing = ["amount", "precision", "nai"].filter((key) => candidate[key] === undefined);
  if (missing.length > 0) throw new SpecError(`${where} is missing ${missing.join(", ")}`, 'Expected {"amount":"100000","precision":3,"nai":"@@000000021"}');

  /*
   * The amount stays a digit string and never goes through `Number`. A round
   * trip loses precision above 2^53 and switches to exponential notation above
   * 1e21 -- "1e+21" is not an amount any chain will read -- and VESTS, at
   * precision 6, reaches that range in ordinary use.
   */
  const amount = requireDigits(candidate.amount, `${where}: "amount"`);

  const precision = toNumber(candidate.precision, `${where}: "precision"`);
  if (!Number.isInteger(precision)) throw new SpecError(`${where}: "precision" must be a whole number, got ${JSON.stringify(candidate.precision)}`);

  /*
   * `String(null)` is "null", and a nai no asset carries makes a whale alert
   * that never fires -- the same failure `toStringList` was hardened against,
   * reached from the other side. `nai: null` survived the `=== undefined` test
   * above, so it has to be checked for shape here.
   */
  const nai = candidate.nai;
  if (typeof nai !== "string" || !NAI.test(nai))
    throw new SpecError(`${where}: "nai" must be an asset identifier, got ${JSON.stringify(nai)}`, 'Expected the "@@000000021" form.');

  return { amount, precision, nai };
}

/**
 * An integer amount, kept as the digit string wax wants.
 *
 * Accepts a number too, because the Raw JSON field produces one, but refuses a
 * non-integer rather than truncating it.
 */
function requireDigits(raw: unknown, where: string): string {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!(/^-?\d+$/).test(text)) throw new SpecError(`${where} must be a whole number of the asset's smallest unit, got ${JSON.stringify(raw)}`);
  return text;
}

/** Wax's NAI form: two at-signs and nine digits. */
const NAI = /^@@\d{9}$/;

function parseJson(raw: string, where: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new SpecError(`${where} is not valid JSON`, (error as Error).message, error);
  }
}

/**
 * The shape the chain will accept, loosely.
 *
 * Not the full rule (which also constrains each dot-separated segment), just
 * enough to catch a value no account could have: a space, an uppercase letter,
 * something far too short.
 */
const ACCOUNT_NAME = /^[a-z][a-z0-9.-]{2,15}$/;

const isNumeric = (value: string): boolean => value !== "" && Number.isFinite(Number(value));

/** The only relative form WorkerBee parses: a leading minus, digits, one unit. */
const RELATIVE_OFFSET = /^-\d+[dhms]$/;
