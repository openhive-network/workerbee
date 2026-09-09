import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const { buildJsonSchema } = shared("schema");
const { buildSpec } = shared("spec");
const { buildCatalog } = shared("catalog");

const schema = buildJsonSchema();
const schemas = schema.components.schemas;

/**
 * Just enough JSON Schema to check this package against its own output.
 *
 * Only the keywords `schema.ts` actually emits: $ref, oneOf, const, enum, type,
 * pattern, required, properties, additionalProperties, items, minItems and the
 * numeric bounds. Deliberately not a general validator -- a dependency for this
 * would be a runtime dependency in a package whose count of those is a
 * publishing constraint.
 */
function validate(value, node, path = "$") {
  const fail = (reason) => [`${path}: ${reason}`];

  if (node.$ref !== undefined) return validate(value, schemas[node.$ref.split("/").pop()], path);

  if (node.oneOf !== undefined) {
    const failures = node.oneOf.map((option) => validate(value, option, path));
    const matched = failures.filter((errors) => errors.length === 0).length;
    return matched === 1 ? [] : fail(`matched ${matched} of ${node.oneOf.length} alternatives`);
  }

  if (node.const !== undefined && value !== node.const) return fail(`expected ${JSON.stringify(node.const)}`);
  if (node.enum !== undefined && !node.enum.includes(value)) return fail(`${JSON.stringify(value)} is not one of ${node.enum.join(", ")}`);

  if (node.type !== undefined) {
    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (!types.some((type) => matchesType(value, type))) return fail(`${JSON.stringify(value)} is not ${types.join(" or ")}`);
  }

  if (node.pattern !== undefined && typeof value === "string" && !new RegExp(node.pattern).test(value))
    return fail(`${JSON.stringify(value)} fails ${node.pattern}`);

  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) return fail(`needs at least ${node.minItems} item(s)`);
    if (node.items !== undefined) return value.flatMap((item, index) => validate(item, node.items, `${path}[${index}]`));
    return [];
  }

  if (value !== null && typeof value === "object") {
    const errors = [];
    for (const key of node.required ?? []) if (!(key in value)) errors.push(`${path}: missing "${key}"`);

    for (const [key, member] of Object.entries(value)) {
      const child = node.properties?.[key];
      if (child === undefined) {
        if (node.additionalProperties === false) errors.push(`${path}: unexpected "${key}"`);
        continue;
      }
      errors.push(...validate(member, child, `${path}.${key}`));
    }
    return errors;
  }

  if (typeof value === "number") {
    if (node.minimum !== undefined && value < node.minimum) return fail(`below minimum ${node.minimum}`);
    if (node.maximum !== undefined && value > node.maximum) return fail(`above maximum ${node.maximum}`);
    if (node.exclusiveMinimum !== undefined && value <= node.exclusiveMinimum) return fail(`not above ${node.exclusiveMinimum}`);
  }

  return [];
}

const matchesType = (value, type) => {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "null") return value === null;
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number";
  return typeof value === type;
};

/** A parameter reader over a plain object, like the one n8n supplies. */
const reader = (values) => (name, fallback) => (name in values ? values[name] : fallback);

describe("the builder's own output validates against the published schema", () => {
  /*
   * `Catalog: Get Schema` exists so a validator or a code generator can be
   * pointed at it. The builder stores the raw form strings -- "alice,bob", "2",
   * "true" -- while the schema published array, integer and boolean, so anyone
   * who did that rejected this node's own output.
   */
  const spec = (events, options = {}) =>
    buildSpec(reader({ specMode: "builder", events: { event: events }, providers: {}, emitMode: "notification", specOptions: {}, ...options }));

  const check = (value) => validate(value, schemas.SubscriptionSpec);

  it("accepts a comma-separated list, which is what the form produces", () => {
    const built = spec([{ event: "posts", joinWithPrevious: "or", parameters: { parameter: [{ name: "authors", value: "alice,bob" }] } }]);

    assert.deepEqual(built.match, [[{ event: "posts", authors: "alice,bob" }]]);
    assert.deepEqual(check(built), []);
  });

  it("accepts a number and a boolean written as text", () => {
    const built = spec([
      {
        event: "witnesses_missed_blocks",
        joinWithPrevious: "or",
        parameters: { parameter: [{ name: "witnesses", value: "gtg" }, { name: "min_count", value: "2" }] },
      },
    ]);

    assert.deepEqual(check(built), []);
  });

  it("still accepts the JSON forms the Raw JSON field produces", () => {
    assert.deepEqual(check({ match: [[{ event: "posts", authors: ["alice", "bob"] }]] }), []);
    assert.deepEqual(check({ match: [[{ event: "witnesses_missed_blocks", witnesses: ["gtg"], min_count: 2 }]] }), []);
  });

  it("validates every example the catalog advertises", () => {
    // These are what `Catalog: Get Events` tells a user to copy.
    const catalog = buildCatalog();
    for (const entry of catalog.events) assert.deepEqual(check({ match: [[entry.example]] }), [], `event ${entry.tag}`);
    for (const entry of catalog.providers) assert.deepEqual(check({ match: [[{ event: "block" }]], provide: [entry.example] }), [], `provider ${entry.tag}`);
  });

  it("still rejects what the compiler rejects", () => {
    assert.notDeepEqual(check({ match: [[{ event: "posts", authorz: "alice" }]] }), [], "an unknown parameter");
    assert.notDeepEqual(check({ match: [[{ event: "no_such_event" }]] }), [], "an unknown event");
    assert.notDeepEqual(check({ match: [[{ event: "posts", authors: ["alice"] }]], mode: "Notification" }), [], "a mode in the wrong case");
    assert.notDeepEqual(check({ match: [[{ event: "posts", authors: ["alice"] }]], max_queue: 0 }), [], "a queue below the minimum");
  });

  it("keeps the queue bounds it publishes in step with the ones it enforces", () => {
    /*
     * These were three copies of 100000 and 500 in three files, with a comment
     * in stream.ts claiming they matched.
     */
    const { DEFAULT_MAX_QUEUE, MAX_QUEUE_CEILING } = shared("stream");
    const published = schemas.SubscriptionSpec.properties.max_queue;

    assert.equal(published.maximum, MAX_QUEUE_CEILING);
    assert.equal(published.default, DEFAULT_MAX_QUEUE);
  });
});
