/**
 * UI parameters -> a subscription spec.
 *
 * The spec is an AND of OR-groups (`[[a, b], [c]]` means `(a OR b) AND c`),
 * mirroring how `QueenBee` composes `and`/`or`, plus a flat list of providers:
 *
 * * **events** are the entries of `match` -- one per `QueenBee.on*`;
 * * **providers** are the entries of `provide` -- one per `QueenBee.provide*`.
 *
 * Collectors and classifiers have no representation here on purpose: they are
 * internal machinery WorkerBee selects from the filters and providers you pick.
 * There is no knob for them in the library either.
 *
 * Values are left as the strings n8n hands over; `compiler.parseParams` coerces
 * and validates them using the type the registry declares, so the visual builder
 * and the Raw JSON field go through exactly one validator.
 */
import { buildCatalog, findEntry } from "./catalog";
import { parseParams, requireMatch } from "./compiler";
import type { ISubscriptionSpec, TSpecEntry } from "./compiler";
import { SpecError } from "./errors";
import { EVENTS_BY_TAG, PROVIDERS_BY_TAG } from "./events";

/**
 * Reads one node parameter. Supplied by the caller because the arity of
 * `getNodeParameter` differs between execute and trigger contexts.
 */
export type TParameterReader = (name: string, fallback?: unknown) => unknown;

interface IEntryUi {
  event?: string;
  provider?: string;
  /** How this entry joins the one above it: "or" keeps the group, "and" starts a new one. */
  joinWithPrevious?: string;
  parameters?: { parameter?: Array<{ name?: string; value?: string }> };
}

/** One UI entry -> one tagged object, checked against the catalog descriptor. */
function buildEntry(entry: IEntryUi, tag: string, kind: "event" | "provider"): TSpecEntry {
  const catalog = buildCatalog();
  const descriptor = findEntry(kind === "event" ? catalog.events : catalog.providers, tag, kind);
  const built: TSpecEntry = { [kind === "event" ? "event" : "provide"]: descriptor.tag };

  const seen = new Set<string>();
  for (const pair of entry.parameters?.parameter ?? []) {
    const name = (pair.name ?? "").trim();
    if (name === "") continue;
    /*
     * The tag keys are skipped by `parseParams`, so a parameter called "event"
     * would quietly replace the chosen event: the row would read "OR votes"
     * while the subscription watched posts.
     */
    if (name === "event" || name === "provide") throw new SpecError(`"${name}" is not a parameter name`, `It is how the ${kind} itself is named.`);
    if (seen.has(name))
      throw new SpecError(`Parameter "${name}" is set twice on "${descriptor.tag}"`, "Only the last value would survive; remove one of the rows.");
    seen.add(name);
    built[name] = pair.value ?? "";
  }

  /*
   * Validate now, so a bad parameter is reported when the workflow is saved or
   * activated rather than when the first matching block arrives.
   */
  parseParams((kind === "event" ? EVENTS_BY_TAG : PROVIDERS_BY_TAG).get(descriptor.tag)!, built);

  return built;
}

/**
 * Build the spec, either from the visual builder or from the raw JSON field for
 * the shapes a two-column UI cannot express.
 */
export function buildSpec(read: TParameterReader): ISubscriptionSpec {
  const spec = read("specMode", "builder") === "json" ? fromJson(read) : fromBuilder(read);
  return withDeliveryOptions(spec, read);
}

function fromJson(read: TParameterReader): ISubscriptionSpec {
  const raw = read("specJson", "");
  /*
   * `unknown`, not a cast: `requireMatch` is an assertion function, so it is
   * what narrows this -- and it now checks the shape rather than trusting it.
   */
  const parsed: unknown = typeof raw === "string" ? parseJson(raw) : raw;
  requireMatch(parsed);
  return parsed;
}

function fromBuilder(read: TParameterReader): ISubscriptionSpec {
  const eventEntries = requireRows(read("events", {}), "event", "Events");
  if (eventEntries.length === 0) throw new SpecError("Add at least one event to watch");

  const spec: ISubscriptionSpec = { match: groupEvents(eventEntries) };

  const providerEntries = requireRows(read("providers", {}), "provider", "Providers");
  if (providerEntries.length > 0) spec.provide = providerEntries.map((entry) => buildEntry(entry, entry.provider as string, "provider"));

  return spec;
}

/**
 * The rows of one fixedCollection, with a half-filled row refused rather than
 * dropped.
 *
 * Dropping it took its `joinWithPrevious` with it, and the neighbours then
 * re-joined under the *next* row's join. `posts (Or) / (pick an event) (And) /
 * votes (Or)` compiled to `posts OR votes`: the user wrote an AND between the
 * two halves of the list and got a filter matching strictly more, with nothing
 * to see in the editor.
 *
 * The cast is checked rather than asserted, because an expression on the
 * parameter itself can resolve to something that is not a collection at all.
 */
function requireRows(raw: unknown, key: "event" | "provider", label: string): IEntryUi[] {
  if (raw === null || typeof raw !== "object") throw new SpecError(`${label} must be a list of rows`, `Got ${JSON.stringify(raw)}`);

  const rows = (raw as Record<string, unknown>)[key];
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) throw new SpecError(`${label} must be a list of rows`, `Got ${JSON.stringify(rows)}`);

  rows.forEach((row, index) => {
    if (row === null || typeof row !== "object") throw new SpecError(`${label} row #${index + 1} is not a row`, `Got ${JSON.stringify(row)}`);
    if (((row as IEntryUi)[key] ?? "") === "")
      throw new SpecError(
        `${label} row #${index + 1} has no ${key} selected`,
        "Pick one or remove the row; an unfinished row would change how the rows around it are joined.",
      );
  });

  return rows as IEntryUi[];
}

/**
 * Fold in Emit Mode and Spec Options, which describe *delivery* rather than what
 * to match.
 *
 * The form shows both in either spec mode, but they used to be read only on the
 * builder path -- so a Raw JSON user could set Emit Mode or Max Queue, save, and
 * have the setting silently discarded. Anything the spec itself already states
 * wins: an explicit key typed into the JSON is more specific than a form default.
 */
function withDeliveryOptions(spec: ISubscriptionSpec, read: TParameterReader): ISubscriptionSpec {
  const mode = String(read("emitMode", "notification"));
  if (spec.mode === undefined && mode !== "notification") spec.mode = mode;

  const options = read("specOptions", {}) as { maxQueue?: number; overflow?: string; endpoint?: string };
  if (spec.max_queue === undefined && options.maxQueue !== undefined) {
    /*
     * Guarded rather than substituted: an unparseable Max Queue used to become
     * NaN, serialise into the spec preview as null, and then be silently
     * replaced by the default at runtime.
     */
    const maxQueue = Number(options.maxQueue);
    if (!Number.isFinite(maxQueue)) throw new SpecError(`Max Queue must be a number, got ${JSON.stringify(options.maxQueue)}`);
    spec.max_queue = maxQueue;
  }
  if (spec.overflow === undefined && options.overflow !== undefined && options.overflow !== "") spec.overflow = options.overflow;
  if (spec.endpoint === undefined && options.endpoint !== undefined && options.endpoint !== "") spec.endpoint = options.endpoint;

  return spec;
}

/**
 * Fold the flat list of event entries into the AND-of-OR-groups a spec needs.
 *
 * Read top to bottom, the way the entries are shown and the way the equivalent
 * `QueenBee` chain is written: consecutive `or` entries accumulate into one
 * group, and an `and` closes that group and opens the next. That is exactly what
 * `QueenBee.applyAnd()` does with its operand buffer, so
 * `posts or votes and impacted` produces `(posts OR votes) AND impacted` on both
 * sides.
 */
function groupEvents(entries: IEntryUi[]): TSpecEntry[][] {
  const match: TSpecEntry[][] = [];

  entries.forEach((entry, index) => {
    const spec = buildEntry(entry, entry.event as string, "event");
    /*
     * The first entry has nothing above it, so its join is ignored -- as the
     * field's own description says.
     */
    const starts = index === 0 || joinMode(entry.joinWithPrevious) === "and";

    if (starts) match.push([spec]);
    else match[match.length - 1].push(spec);
  });

  return match;
}

/**
 * Read one entry's join, refusing anything that is not a join.
 *
 * This used to be a bare `=== "and"`, so every other value fell through to OR --
 * and `joinWithPrevious` has no `noDataExpression`, so an expression can deliver
 * anything. "AND" in the wrong case silently widened the filter. `emitMode` is
 * strict for exactly this reason; the join was not, and a filter that matches
 * *more* than the user wrote is the worse of the two failures.
 */
function joinMode(requested: string | undefined): "or" | "and" {
  if (requested === undefined || requested === "") return "or";
  if (requested === "or" || requested === "and") return requested;

  throw new SpecError(`"${requested}" is not a way to join two events`, "It accepts: or, and.");
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new SpecError("The raw spec is not valid JSON", (error as Error).message, error);
  }
}

export type { ISubscriptionSpec };
