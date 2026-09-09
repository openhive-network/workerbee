/**
 * The self-description of this package: every event and provider it can watch.
 *
 * Nothing about Hive is hard-coded in the node UIs. The dropdowns, the parameter
 * names, their types, defaults and one-line summaries are all derived here from
 * {@link EVENTS} and {@link PROVIDERS}, so adding an observer to `events.ts`
 * makes it appear in the editor without touching a form definition.
 *
 * The catalog is also served to the user through the `Catalog: Get Events`
 * operation of the Hive node, which is how you find out what to put in the
 * `Raw JSON` spec field.
 */
import { EMIT_MODES } from "./emitter";
import { SpecError } from "./errors";
import { EVENTS, PROVIDERS } from "./events";
import type { IFieldDescriptor, ISpecDescriptor, TFieldType } from "./events";
import { OVERFLOW_POLICIES } from "./stream";

export interface ICatalogField {
  name: string;
  type: string;
  required: boolean;
  default?: string | number | boolean | string[];
  description: string;
}

export interface ICatalogEntry {
  tag: string;
  kind: "event" | "provider";
  summary: string;
  fields: ICatalogField[];
  /** A spec fragment that can be pasted straight into the Raw JSON field. */
  example: Record<string, unknown>;
}

export interface ICatalog {
  events: ICatalogEntry[];
  providers: ICatalogEntry[];
  modes: string[];
  overflow: string[];
}

/** Sample values used to build the copy-pasteable example per event. */
const SAMPLE_VALUES: Record<string, unknown> = {
  accounts: ["alice", "bob"],
  authors: ["alice"],
  voters: ["alice"],
  witnesses: ["gtg"],
  transaction_ids: ["0000000000000000000000000000000000000000"],
  ids: ["splinterlands"],
  block_number: 80000000,
  percent: 5,
  asset: { amount: "100000", precision: 3, nai: "@@000000021" },
};

/** Render an annotation the way a human reading the catalog expects. */
export function typeName(type: TFieldType): string {
  switch (type.kind) {
  case "names":
  case "strings":
    return "list[str]";
  case "int":
    return "int";
  case "float":
    return "float";
  case "bool":
    return "bool";
  case "relativeTime":
    return "int | str";
  case "manabar":
    return "upvote | downvote | rc";
  case "asset":
    return "NaiAsset";
  // Skip default: exhaustive over TFieldType, deliberately
  }
}

function describe(descriptor: ISpecDescriptor): ICatalogEntry {
  const tagKey = descriptor.kind === "event" ? "event" : "provide";
  const example: Record<string, unknown> = { [tagKey]: descriptor.tag };

  for (const field of descriptor.fields) if (field.default === undefined) example[field.name] = sampleFor(field);

  return {
    tag: descriptor.tag,
    kind: descriptor.kind,
    summary: descriptor.summary,
    fields: descriptor.fields.map((field) => ({
      name: field.name,
      type: typeName(field.type),
      required: field.default === undefined,
      ...(field.default === undefined ? {} : { default: field.default }),
      description: field.description,
    })),
    example,
  };
}

function sampleFor(field: IFieldDescriptor): unknown {
  const sample = SAMPLE_VALUES[field.name];
  if (sample !== undefined) return sample;
  return field.type.kind === "names" || field.type.kind === "strings" ? ["value"] : "value";
}

let cached: ICatalog | undefined;

/**
 * Everything this package can watch. Computed once; the registry is static.
 *
 * The cached object is shared, and `spec.ts` validates every subscription in the
 * process against it -- so callers that hand it onwards as workflow data (where
 * a downstream node may mutate `$json`) must take {@link catalogCopy} instead.
 */
export function buildCatalog(): ICatalog {
  cached ??= {
    events: EVENTS.map(describe),
    providers: PROVIDERS.map(describe),
    modes: [...EMIT_MODES],
    overflow: [...OVERFLOW_POLICIES],
  };
  return cached;
}

/** A private copy of the catalog, safe to emit as an n8n item. */
export const catalogCopy = (): ICatalog => structuredClone(buildCatalog());

// ------------------------------------------------------------------- n8n glue

/** `accounts_balance_change` -> `Accounts Balance Change`. */
export function titleCase(tag: string): string {
  return tag
    .split("_")
    .map((word) => (word === "" ? word : word[0].toUpperCase() + word.slice(1)))
    .join(" ");
}

export function toOptions(entries: ICatalogEntry[]): Array<{ name: string; value: string; description: string }> {
  return entries
    .map((entry) => ({ name: titleCase(entry.tag), value: entry.tag, description: describeEntry(entry) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function describeEntry(entry: ICatalogEntry): string {
  const required = entry.fields.filter((field) => field.required).map((field) => field.name);
  const optional = entry.fields.filter((field) => !field.required).map((field) => field.name);
  const parts = [entry.summary];
  if (required.length > 0) parts.push(`Required: ${required.join(", ")}.`);
  if (optional.length > 0) parts.push(`Optional: ${optional.join(", ")}.`);
  return parts.join(" ");
}

/**
 * Parameter names of one entry, for the second dropdown.
 *
 * When the selected tag cannot be resolved -- `loadOptionsDependsOn` inside a
 * fixed collection does not always hand the sibling value over -- this falls
 * back to the union over every entry rather than to an empty list, so the node
 * stays usable and only loses the narrowing.
 */
export function fieldOptions(entries: ICatalogEntry[], tag: unknown): Array<{ name: string; value: string; description: string }> {
  const selected = typeof tag === "string" ? entries.find((entry) => entry.tag === tag) : undefined;

  /*
   * An empty dropdown just looks broken. The hint's value is the empty string,
   * which `buildEntry` skips, so choosing it cannot produce an invalid spec.
   */
  if (selected !== undefined && selected.fields.length === 0)
    return [{ name: `"${selected.tag}" takes no parameters`, value: "", description: selected.summary }];

  const fields = selected !== undefined ? selected.fields : dedupe(entries.flatMap((entry) => entry.fields));

  return fields
    .map((field) => ({ name: titleCase(field.name), value: field.name, description: fieldHint(field, selected === undefined) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function fieldHint(field: ICatalogField, unnarrowed: boolean): string {
  const parts = [`${field.type}${field.required ? ", required" : ""}`];
  if (field.default !== undefined) parts.push(`default ${JSON.stringify(field.default)}`);
  parts.push(field.description);
  if (unnarrowed) parts.push("Shown because the selected event could not be resolved -- check it applies.");
  return parts.join(" -- ");
}

function dedupe(fields: ICatalogField[]): ICatalogField[] {
  const seen = new Map<string, ICatalogField>();
  for (const field of fields) if (!seen.has(field.name)) seen.set(field.name, field);
  return [...seen.values()];
}

export function findEntry(entries: ICatalogEntry[], tag: string, kind: "event" | "provider"): ICatalogEntry {
  const entry = entries.find((candidate) => candidate.tag === tag);
  /*
   * A SpecError, not a bare Error: this reaches the user the same way an unknown
   * parameter does, and `errors.ts` promises every one of them carries a `code` a
   * workflow can branch on.
   */
  if (entry === undefined) throw new SpecError(`Unknown ${kind} "${tag}"`, `This node offers: ${entries.map((candidate) => candidate.tag).join(", ")}`);
  return entry;
}
