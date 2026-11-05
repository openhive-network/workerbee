/**
 * JSON Schema for everything this package accepts and emits.
 *
 * Derived from the very registry that validates a spec and from the item shapes
 * the emitter produces, so the documented contract cannot drift from the
 * implemented one. Served through the Hive node's `Catalog: Get Schema`
 * operation, which is what to point a validator or a code generator at.
 */
import { EMIT_MODES } from "./emitter";
import { EVENTS, MANABAR_KINDS, PROVIDERS } from "./events";
import type { IFieldDescriptor, ISpecDescriptor, TFieldType } from "./events";
import { DEFAULT_MAX_QUEUE, MAX_QUEUE_CEILING, OVERFLOW_POLICIES } from "./stream";

type TSchema = Record<string, unknown>;

const ANY_JSON: TSchema = { description: "Any JSON value: object, array, string, number, boolean or null." };

/**
 * The list, number and boolean forms the compiler really accepts.
 *
 * `coerce` is deliberately lenient, because a value reaches it either as JSON
 * from the Raw JSON field or as a string typed into the visual builder, and both
 * have to mean the same thing. The schema described only the JSON half, so the
 * builder's own output -- `{"authors": "alice,bob"}`, `{"min_count": "2"}` --
 * failed validation against the schema this package publishes for validating it.
 * Whichever half was wrong, they cannot both be right.
 */
const orTyped = (typed: TSchema, description: string): TSchema => ({ oneOf: [typed, { type: "string", description }] });

function fieldSchema(type: TFieldType): TSchema {
  switch (type.kind) {
  case "names":
    return orTyped({ type: "array", items: { type: "string" }, minItems: 1 }, "One or more names, comma-separated");
  case "strings":
    return orTyped({ type: "array", items: { type: "string" } }, "Comma-separated values");
  case "int":
    return orTyped(
      { type: "integer", ...(type.min === undefined ? {} : { minimum: type.min }), ...(type.max === undefined ? {} : { maximum: type.max }) },
      "A whole number written as text",
    );
  case "float":
    return orTyped(
      {
        type: "number",
        ...(type.min === undefined ? {} : { minimum: type.min }),
        ...(type.max === undefined ? {} : { maximum: type.max }),
        ...(type.exclusiveMin === undefined ? {} : { exclusiveMinimum: type.exclusiveMin }),
      },
      "A number written as text",
    );
  case "bool":
    return orTyped({ type: "boolean" }, "true, false, 1, 0, yes, no, on or off");
  case "relativeTime":
    return {
      oneOf: [{ type: "integer" }, { type: "string", pattern: "^(-\\d+[dhms]|\\d+)$" }, { type: "string", format: "date-time" }],
      description: "Milliseconds, or a WorkerBee relative offset such as -1h. The leading minus is required on an offset",
    };
  case "manabar":
    return { type: "string", enum: Object.keys(MANABAR_KINDS) };
  case "asset":
    return {
      oneOf: [
        {
          type: "object",
          required: ["amount", "precision", "nai"],
          properties: {
            amount: { oneOf: [{ type: "string", pattern: "^-?\\d+$" }, { type: "integer" }] },
            precision: { oneOf: [{ type: "integer" }, { type: "string", pattern: "^\\d+$" }] },
            nai: { type: "string", pattern: "^@@\\d{9}$" },
          },
          additionalProperties: false,
        },
        { type: "string", description: "The same object as a JSON string, which is what the visual builder produces" },
      ],
    };
  // Skip default: exhaustive over TFieldType, deliberately
  }
}

function entrySchema(descriptor: ISpecDescriptor): TSchema {
  const tagKey = descriptor.kind === "event" ? "event" : "provide";
  const properties: TSchema = { [tagKey]: { const: descriptor.tag } };
  const required = [tagKey];

  for (const field of descriptor.fields) {
    properties[field.name] = { ...fieldSchema(field.type), description: field.description, ...defaultOf(field) };
    if (field.default === undefined) required.push(field.name);
  }

  return { title: descriptor.tag, description: descriptor.summary, type: "object", properties, required, additionalProperties: false };
}

const defaultOf = (field: IFieldDescriptor): TSchema => (field.default === undefined ? {} : { default: field.default });

const ENVELOPE_PROPERTIES: TSchema = {
  kind: { type: "string" },
  subscriptionId: { type: "string" },
  seq: { type: "integer", description: "Per-subscription sequence number; a gap means items were dropped." },
  emittedAt: { type: "string", format: "date-time" },
  blockNum: { type: ["integer", "null"] },
  blockId: { type: ["string", "null"] },
};

const ENVELOPE_REQUIRED = ["kind", "subscriptionId", "seq", "emittedAt", "blockNum", "blockId"];

/** OpenAPI-style `components.schemas` for every public request/response shape. */
export function buildJsonSchema(): TSchema {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "@hiveio/n8n-nodes-hive",
    components: {
      schemas: {
        SubscriptionSpec: {
          title: "SubscriptionSpec",
          description: '"match" is an AND of OR-groups: [[a, b], [c]] means (a OR b) AND c.',
          type: "object",
          required: ["match"],
          additionalProperties: false,
          properties: {
            match: { type: "array", minItems: 1, items: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/EventEntry" } } },
            provide: { type: "array", items: { $ref: "#/components/schemas/ProviderEntry" } },
            mode: { type: "string", enum: [...EMIT_MODES], default: "notification" },
            max_queue: { type: "integer", minimum: 1, maximum: MAX_QUEUE_CEILING, default: DEFAULT_MAX_QUEUE },
            overflow: { type: "string", enum: [...OVERFLOW_POLICIES], default: "drop_oldest" },
            endpoint: { type: "string", description: "Hive API node for this subscription only" },
          },
        },
        EventEntry: { oneOf: EVENTS.map(entrySchema) },
        ProviderEntry: { oneOf: PROVIDERS.map(entrySchema) },
        NotificationItem: {
          title: "NotificationItem",
          description: "Emit mode 'notification': the whole merged WorkerBee payload as one item.",
          type: "object",
          required: [...ENVELOPE_REQUIRED, "payload"],
          properties: { ...ENVELOPE_PROPERTIES, kind: { const: "notification" }, payload: ANY_JSON },
        },
        OperationItem: {
          title: "OperationItem",
          description: "Emit mode 'operation': one operation flattened out of the payload.",
          type: "object",
          required: [...ENVELOPE_REQUIRED, "group", "account", "operation", "transactionId"],
          properties: {
            ...ENVELOPE_PROPERTIES,
            kind: { const: "operation" },
            group: { type: "string", description: "The notification key the operation came from" },
            account: { type: ["string", "null"], description: "The tracked name it was grouped under; null when the group is not account-keyed" },
            key: {
              type: "string",
              description: "What the group was keyed by when that is not an account -- the custom_json app id, for customOperations. Absent otherwise",
            },
            operation: ANY_JSON,
            transactionId: { type: ["string", "null"] },
            context: {
              type: "object",
              description: "Payload keys carrying no operations -- provider data and the rest of the block. Absent when the payload has none",
            },
          },
        },
        EmittedItem: { oneOf: [{ $ref: "#/components/schemas/NotificationItem" }, { $ref: "#/components/schemas/OperationItem" }] },
        ChainStatus: {
          title: "ChainStatus",
          type: "object",
          required: ["endpoint", "headBlockNumber", "headBlockId", "time"],
          properties: {
            endpoint: { type: "string" },
            headBlockNumber: { type: "integer" },
            headBlockId: { type: "string" },
            time: { type: "string" },
          },
        },
        AccountResult: {
          title: "AccountResult",
          type: "object",
          required: ["endpoint", "name", "account"],
          properties: { endpoint: { type: "string" }, name: { type: "string" }, account: ANY_JSON },
        },
        BlockResult: {
          title: "BlockResult",
          type: "object",
          required: ["endpoint", "blockNum", "block"],
          properties: { endpoint: { type: "string" }, blockNum: { type: "integer" }, block: ANY_JSON },
        },
      },
    },
  };
}
