import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { realBot, recorder, shared } from "./helpers.mjs";

const { buildCatalog, typeName, titleCase, toOptions, fieldOptions } = shared("catalog");
const { EVENTS, PROVIDERS, MANABAR_KINDS } = shared("events");
const { compileSpec } = shared("compiler");
const { buildJsonSchema } = shared("schema");

const catalog = buildCatalog();

describe("catalog", () => {
  it("gives every entry a unique tag", () => {
    const tags = [...EVENTS, ...PROVIDERS].map((entry) => entry.tag);
    assert.equal(new Set(tags).size, tags.length);
  });

  it("describes every field with a type a human can act on", () => {
    for (const entry of [...catalog.events, ...catalog.providers])
      for (const field of entry.fields) {
        assert.ok(field.type.length > 0, `${entry.tag}.${field.name} has no type`);
        assert.ok(field.description.length > 0, `${entry.tag}.${field.name} has no description`);
      }
  });

  it("marks optional fields with the default that will be used", () => {
    const witnesses = catalog.events.find((entry) => entry.tag === "witnesses_missed_blocks");
    assert.deepEqual(witnesses.fields.find((field) => field.name === "min_count"), {
      name: "min_count",
      type: "int",
      required: false,
      default: 1,
      description: "Missed blocks that trigger the event",
    });
  });

  it("produces an example that actually compiles", () => {
    for (const entry of catalog.events) {
      const { chain } = recorder();
      compileSpec(chain, { match: [[entry.example]] });
    }
    for (const entry of catalog.providers) {
      const { chain } = recorder();
      compileSpec(chain, { match: [[{ event: "block" }]], provide: [entry.example] });
    }
  });

  it("renders tags and types the way the dropdowns show them", () => {
    assert.equal(titleCase("accounts_balance_change"), "Accounts Balance Change");
    assert.equal(typeName({ kind: "names" }), "list[str]");
    assert.equal(typeName({ kind: "relativeTime" }), "int | str");
    assert.equal(toOptions(catalog.events).length, catalog.events.length);
    assert.ok(fieldOptions(catalog.events, "posts").some((option) => option.value === "authors"));
  });

  it("falls back to the union of fields when the sibling event cannot be resolved", () => {
    const options = fieldOptions(catalog.events, undefined);
    assert.ok(options.length > fieldOptions(catalog.events, "posts").length);
  });
});

describe("json schema", () => {
  const schema = buildJsonSchema();

  it("carries one alternative per event and per provider", () => {
    assert.equal(schema.components.schemas.EventEntry.oneOf.length, EVENTS.length);
    assert.equal(schema.components.schemas.ProviderEntry.oneOf.length, PROVIDERS.length);
  });

  it("describes both emitted item shapes", () => {
    assert.deepEqual(
      schema.components.schemas.EmittedItem.oneOf.map((entry) => entry.$ref),
      ["#/components/schemas/NotificationItem", "#/components/schemas/OperationItem"],
    );
  });
});

describe("against the real QueenBee", () => {
  let fixture;

  before(async () => {
    fixture = await realBot();
  });

  after(() => fixture?.close());

  it("exposes every observer QueenBee offers, and no more", () => {
    // OnSubscribe/onUnsubscribe are QueenBee's own lifecycle hooks, not
    // Observers; everything else matching on*/provide* must be reachable.
    const lifecycle = new Set(["onSubscribe", "onUnsubscribe"]);
    const prototype = Object.getPrototypeOf(fixture.bot.observe);
    const offered = Object.getOwnPropertyNames(prototype).filter((name) => /^(on|provide)[A-Z]/.test(name) && !lifecycle.has(name));

    const used = [...EVENTS, ...PROVIDERS].map((entry) => methodCalledBy(entry));

    assert.deepEqual([...used].sort(), [...offered].sort());
  });

  it("maps each tag to the observer named after it, not merely to some observer", () => {
    /*
     * The check above compares two multisets, so swapping the `apply` bodies of
     * any two entries with the same signature passes it -- and thirteen
     * observers share `(...string[]) => IObserverChain`. `posts` calling
     * `onVotes` was invisible.
     */
    for (const [list, prefix] of [
      [EVENTS, "on"],
      [PROVIDERS, "provide"],
    ])
      for (const entry of list) assert.equal(methodCalledBy(entry), camelCase(entry.tag, prefix), `"${entry.tag}" must call the observer named after it`);
  });

  it("compiles every event and provider against the real chain builder", () => {
    for (const entry of catalog.events) compileSpec(fixture.bot.observe, { match: [[entry.example]] });
    for (const entry of catalog.providers) compileSpec(fixture.bot.observe, { match: [[{ event: "block" }]], provide: [entry.example] });
  });

  it("spells the manabar enum the way wax does", async () => {
    const { EManabarType } = await import("@hiveio/wax");
    assert.deepEqual(MANABAR_KINDS, { upvote: EManabarType.UPVOTE, downvote: EManabarType.DOWNVOTE, rc: EManabarType.RC });
  });

  it("passes the manabar type and the percent in the order QueenBee expects", async () => {
    /*
     * The one argument order `IObserverChain` cannot pin. `EManabarType` is a
     * numeric enum, and TypeScript accepts a number where one is expected, so
     * swapping (manabarType, percent) in src/queen.ts compiles cleanly on both
     * sides and only goes wrong at runtime -- watching the wrong manabar at the
     * wrong threshold. Every other observer's types differ enough to be caught.
     */
    const { EManabarType } = await import("@hiveio/wax");
    const queen = fixture.bot.observe;

    compileSpec(queen, { match: [[{ event: "accounts_manabar_percent", accounts: ["alice"], percent: 80, manabar: "rc" }]] });

    const filter = queen.operands.at(-1);
    assert.equal(filter.manabarType, EManabarType.RC, "the manabar type must not arrive as the percent");
    assert.equal(filter.manabarLoadPercent, 80, "the percent must not arrive as the manabar type");
  });
});

/** The single QueenBee method one registry entry calls. */
function methodCalledBy(entry) {
  const { chain, calls } = recorder();
  entry.apply(chain, stubParams(entry));

  const used = calls.map(([name]) => name).filter((name) => name !== "and");
  assert.equal(used.length, 1, `"${entry.tag}" must call exactly one observer, called: ${used.join(", ") || "none"}`);
  return used[0];
}

const camelCase = (tag, prefix) => prefix + tag.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join("");

function stubParams(entry) {
  const fields = new Map(entry.fields.map((field) => [field.name, field]));
  const values = Object.fromEntries(entry.fields.map((field) => [field.name, sample(field)]));

  /*
   * Deliberately not one aliased reader for all nine. That is what the real
   * IParams used to be, and it is why a descriptor could call the wrong
   * accessor for a field's kind -- or name a field that does not exist -- and
   * still pass here.
   */
  const read = (kind) => (name) => {
    const field = fields.get(name);
    assert.ok(field !== undefined, `"${entry.tag}" reads an undeclared parameter "${name}"`);
    assert.equal(field.type.kind, kind, `"${entry.tag}" reads "${name}" as ${kind}, but it is declared ${field.type.kind}`);
    return values[name];
  };

  return {
    names: read("names"),
    strings: read("strings"),
    int: read("int"),
    float: read("float"),
    bool: read("bool"),
    relativeTime: read("relativeTime"),
    manabar: read("manabar"),
    asset: read("asset"),
  };
}

function sample(field) {
  switch (field.type.kind) {
  case "names":
  case "strings":
    return ["alice"];
  case "int":
  case "float":
    return 1;
  case "bool":
    return false;
  case "manabar":
    return 0;
  case "asset":
    return { amount: "1", precision: 3, nai: "@@000000021" };
  default:
    return "x";
  }
}
