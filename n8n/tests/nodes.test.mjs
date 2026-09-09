import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import { shared } from "./helpers.mjs";

const require = createRequire(import.meta.url);

const { HiveApi } = require("../dist/credentials/HiveApi.credentials.js");
const { HivePostingKey } = require("../dist/credentials/HivePostingKey.credentials.js");
const { Hive } = require("../dist/nodes/Hive/Hive.node.js");
const { HiveTrigger } = require("../dist/nodes/HiveTrigger/HiveTrigger.node.js");

const { buildSpec } = shared("spec");
const { loadOptions } = shared("load-options");
const { specProperties } = shared("properties");

/** A parameter reader over a plain object, like the one n8n supplies. */
const reader = (values) => (name, fallback) => (name in values ? values[name] : fallback);

describe("node definitions", () => {
  it("keeps the read-only credential optional and asks for a key only to publish", () => {
    /*
     * The endpoint credential carries no secret, so nothing should force it. The
     * posting key is the opposite: required, and only where something is written.
     */
    assert.equal(new HiveApi().name, "hiveApi");
    assert.equal(new HivePostingKey().name, "hivePostingKey");

    assert.deepEqual(new HiveTrigger().description.credentials, [{ name: "hiveApi", required: false }]);

    const [readOnly, key] = new Hive().description.credentials;
    assert.deepEqual(readOnly, { name: "hiveApi", required: false });
    assert.equal(key.name, "hivePostingKey");
    assert.equal(key.required, true);
    assert.deepEqual(key.displayOptions.show.resource, ["comment"], "the key must be asked for only by the writing resource");
  });

  it("marks the posting key as a password and never gives it a default", () => {
    const [account, posting] = new HivePostingKey().properties;
    assert.equal(account.name, "account");
    assert.equal(posting.name, "postingKey");
    assert.equal(posting.typeOptions?.password, true, "a private key must not render in clear text");
    assert.equal(posting.default, "", "a key must never ship with a value");
  });

  it("registers the trigger as a trigger with no inputs", () => {
    const trigger = new HiveTrigger();
    assert.deepEqual(trigger.description.group, ["trigger"]);
    assert.deepEqual(trigger.description.inputs, []);
    assert.equal(typeof trigger.trigger, "function");
  });

  it("registers the action node with an execute and every documented resource", () => {
    const hive = new Hive();
    assert.equal(typeof hive.execute, "function");
    const resources = hive.description.properties.find((property) => property.name === "resource").options.map((option) => option.value);
    assert.deepEqual(resources, ["account", "block", "catalog", "chain", "comment", "spec"]);
  });

  it("points every icon and codex file at something the build copied", () => {
    for (const node of [new Hive(), new HiveTrigger()]) assert.equal(node.description.icon, "file:hive.svg");
  });

  it("feeds the dropdowns without any network access", async () => {
    const events = await loadOptions.getEvents.call({});
    const providers = await loadOptions.getProviders.call({});
    assert.ok(events.some((option) => option.value === "posts"));
    assert.ok(providers.some((option) => option.value === "block_data"));
  });
});

/**
 * The context n8n really constructs for a dropdown inside a fixed collection:
 * `path` points at the parameter being loaded, and `getCurrentNodeParameter`
 * reads from the node's parameters.
 */
function loadOptionsContext(path, parameters) {
  return {
    path,
    getCurrentNodeParameter: (name) => name.split(/[.[\]]+/).filter(Boolean).reduce((value, key) => value?.[key], parameters),
    getCurrentNodeParameters: () => parameters,
  };
}

describe("parameter dropdowns narrow to the selected entry", () => {
  const entry = (tag) => ({ event: tag, joinWithPrevious: "or", parameters: { parameter: [{ name: "", value: "" }] } });
  const parameters = (...events) => ({ events: { event: events }, providers: { provider: [{ provider: "manabar_data" }] } });

  it("offers only the fields of the event chosen in the same entry", async () => {
    const context = loadOptionsContext("parameters.events.event[0].parameters.parameter[0].name", parameters(entry("posts")));
    assert.deepEqual((await loadOptions.getEventFields.call(context)).map((option) => option.value), ["authors"]);
  });

  it("reads the right entry when several events are configured", async () => {
    const context = loadOptionsContext(
      "parameters.events.event[1].parameters.parameter[0].name",
      parameters(entry("posts"), entry("witnesses_missed_blocks")),
    );
    assert.deepEqual((await loadOptions.getEventFields.call(context)).map((option) => option.value).sort(), ["min_count", "witnesses"]);
  });

  it("says so, rather than offering somebody else's parameters, when the event takes none", async () => {
    const context = loadOptionsContext("parameters.events.event[0].parameters.parameter[0].name", parameters(entry("block")));
    const options = await loadOptions.getEventFields.call(context);
    // The empty value is what makes the hint harmless: buildEntry skips it.
    assert.deepEqual(options.map((option) => option.value), [""]);
    assert.match(options[0].name, /takes no parameters/);
  });

  it("narrows the provider dropdown the same way", async () => {
    const context = loadOptionsContext("parameters.providers.provider[0].parameters.parameter[0].name", parameters(entry("block")));
    assert.deepEqual((await loadOptions.getProviderFields.call(context)).map((option) => option.value).sort(), ["accounts", "manabar"]);
  });

  it("falls back to every field when the context does not expose a path", async () => {
    const options = await loadOptions.getEventFields.call({ getCurrentNodeParameter: () => undefined });
    assert.ok(options.length > 5, "an unnarrowed list keeps the node usable");
    assert.match(options[0].description, /could not be resolved/);
  });
});

describe("buildSpec", () => {
  const builderValues = {
    specMode: "builder",
    events: { event: [{ event: "posts", joinWithPrevious: "or", parameters: { parameter: [{ name: "authors", value: "alice,bob" }] } }] },
    providers: {},
    emitMode: "notification",
    specOptions: {},
  };

  const withEvents = (...events) => reader({ ...builderValues, events: { event: events } });
  const event = (tag, join, params = {}) => ({
    event: tag,
    joinWithPrevious: join,
    parameters: { parameter: Object.entries(params).map(([name, value]) => ({ name, value })) },
  });

  it("turns the visual builder into the spec the compiler accepts", () => {
    assert.deepEqual(buildSpec(reader(builderValues)), { match: [[{ event: "posts", authors: "alice,bob" }]] });
  });

  it("keeps consecutive Or entries in one group", () => {
    const spec = buildSpec(withEvents(event("posts", "or", { authors: "alice" }), event("votes", "or", { voters: "carol" })));
    assert.deepEqual(spec.match, [[{ event: "posts", authors: "alice" }, { event: "votes", voters: "carol" }]]);
  });

  it("starts a new group at an And, the way QueenBee.and closes its operand buffer", () => {
    const spec = buildSpec(withEvents(event("posts", "or", { authors: "alice" }), event("votes", "and", { voters: "carol" })));
    assert.deepEqual(spec.match, [[{ event: "posts", authors: "alice" }], [{ event: "votes", voters: "carol" }]]);
  });

  it("reads (posts or votes) and impacted the way the list is written", () => {
    const spec = buildSpec(
      withEvents(
        event("posts", "or", { authors: "alice,bob" }),
        event("votes", "or", { voters: "alice" }),
        event("impacted_accounts", "and", { accounts: "alice" }),
      ),
    );
    assert.deepEqual(spec.match, [
      [
        { event: "posts", authors: "alice,bob" },
        { event: "votes", voters: "alice" },
      ],
      [{ event: "impacted_accounts", accounts: "alice" }],
    ]);
  });

  it("ignores the join on the first entry, which has nothing above it", () => {
    const asAnd = buildSpec(withEvents(event("posts", "and", { authors: "alice" })));
    const asOr = buildSpec(withEvents(event("posts", "or", { authors: "alice" })));
    assert.deepEqual(asAnd.match, asOr.match);
  });

  it("carries the emit mode and options only when they differ from the default", () => {
    assert.equal(buildSpec(reader(builderValues)).mode, undefined);
    const spec = buildSpec(reader({ ...builderValues, emitMode: "operation", specOptions: { maxQueue: 10, overflow: "drop_newest" } }));
    assert.equal(spec.mode, "operation");
    assert.equal(spec.max_queue, 10);
    assert.equal(spec.overflow, "drop_newest");
  });

  it("validates in the editor rather than at the first matching block", () => {
    assert.throws(() => buildSpec(withEvents(event("posts", "or"))), (error) => error.message.includes("missing required parameter"));
  });

  it("accepts a raw spec for the shapes the builder cannot express", () => {
    const raw = '{"match":[[{"event":"posts","authors":["alice"]}],[{"event":"votes","voters":["bob"]}]],"provide":[{"provide":"block_data"}]}';
    assert.deepEqual(buildSpec(reader({ specMode: "json", specJson: raw })).provide, [{ provide: "block_data" }]);
  });

  it("applies the emit mode and options to a raw spec too", () => {
    /*
     * The form shows Emit Mode and Spec Options in both modes. They used to be
     * read only on the builder path, so a Raw JSON user could set them, save, and
     * have them silently discarded.
     */
    const raw = '{"match":[[{"event":"posts","authors":["alice"]}]]}';
    const spec = buildSpec(reader({ specMode: "json", specJson: raw, emitMode: "operation", specOptions: { maxQueue: 25, overflow: "drop_newest" } }));
    assert.equal(spec.mode, "operation");
    assert.equal(spec.max_queue, 25);
    assert.equal(spec.overflow, "drop_newest");
  });

  it("lets the raw spec win over the form for anything it states itself", () => {
    const raw = '{"match":[[{"event":"posts","authors":["alice"]}]],"mode":"notification","max_queue":7}';
    const spec = buildSpec(reader({ specMode: "json", specJson: raw, emitMode: "operation", specOptions: { maxQueue: 25 } }));
    assert.equal(spec.mode, "notification");
    assert.equal(spec.max_queue, 7);
  });

  it("refuses a parameter row that would rename the event itself", () => {
    const spec = () => buildSpec(withEvents({ event: "votes", joinWithPrevious: "or", parameters: { parameter: [{ name: "event", value: "posts" }] } }));
    assert.throws(spec, (error) => error.message.includes("is not a parameter name"));
  });

  it("refuses the same parameter twice instead of keeping only the last", () => {
    const spec = () =>
      buildSpec(
        withEvents({
          event: "posts",
          joinWithPrevious: "or",
          parameters: { parameter: [{ name: "authors", value: "alice" }, { name: "authors", value: "bob" }] },
        }),
      );
    assert.throws(spec, (error) => error.message.includes("is set twice"));
  });

  it("rejects a raw spec that is not valid JSON", () => {
    assert.throws(() => buildSpec(reader({ specMode: "json", specJson: "{oops" })), (error) => error.message.includes("not valid JSON"));
  });

  it("refuses to build a spec with no events", () => {
    assert.throws(() => buildSpec(reader({ ...builderValues, events: {} })), (error) => error.message.includes("at least one event"));
  });
});

describe("errors leaving a node", () => {
  const { asNodeError } = shared("node-errors");
  const { SpecError, NotFoundError, UpstreamError, CredentialError } = shared("errors");
  const node = { id: "1", name: "Hive", type: "hive", typeVersion: 1, position: [0, 0], parameters: {} };

  it("turns an upstream failure into a NodeApiError", () => {
    /*
     * N8n classifies an API failure differently from a bad workflow: it is the
     * Hive node that failed, not the spec the user wrote.
     */
    const error = asNodeError(node, new UpstreamError("Hive endpoint x failed", "socket hang up"));
    assert.equal(error.constructor.name, "NodeApiError");
    assert.equal(error.description, "socket hang up");
  });

  it("does not smuggle the error code into httpCode", () => {
    /*
     * NodeApiError reads a `code` in the response it is handed as the HTTP
     * status, so passing ours there reported httpCode "upstream_error" -- a
     * status that does not exist, on an error that never had one.
     */
    assert.equal(asNodeError(node, new UpstreamError("failed", "socket hang up")).httpCode, null);
  });

  it("turns every other package error into a NodeOperationError, keeping the code", () => {
    for (const [source, code] of [
      [new SpecError("bad spec", "detail"), "invalid_spec"],
      [new NotFoundError('No such account "x"'), "not_found"],
      [new CredentialError("The Hive API credential could not be read", "not found"), "credential_error"],
    ]) {
      const error = asNodeError(node, source);
      assert.equal(error.constructor.name, "NodeOperationError");
      assert.equal(error.type, code, "the machine-readable code must survive as n8n's type");
    }
  });

  it("blames the credential, not the Hive node, when the credential is unreadable", () => {
    /*
     * Every UpstreamError maps to NodeApiError; routing a credential failure
     * through it would render an API fault against a blockchain node that is
     * perfectly healthy.
     */
    assert.equal(asNodeError(node, new CredentialError("unreadable", "gone")).constructor.name, "NodeOperationError");
  });

  it("does not print the detail twice, once in the title and once beneath it", () => {
    /*
     * HiveNodeError.message already ends with the detail; n8n renders title and
     * description one above the other.
     */
    const error = asNodeError(node, new SpecError('Parameter "authors" is set twice', "Remove one of the rows."));
    assert.equal(error.message, 'Parameter "authors" is set twice');
    assert.equal(error.description, "Remove one of the rows.");
  });

  it("wraps an error it does not recognise rather than letting it through raw", () => {
    const error = asNodeError(node, new TypeError("undefined is not a function"));
    assert.equal(error.constructor.name, "NodeOperationError");
    assert.equal(error.message, "undefined is not a function");
  });

  it("leaves an already-translated error alone instead of nesting it", () => {
    /*
     * A node file throws n8n's type directly and `execute` sees it again on the
     * way out; re-wrapping would bury the type the first translation set.
     */
    const once = asNodeError(node, new NotFoundError("gone"), 0);
    const twice = asNodeError(node, once, 0);
    assert.equal(twice, once);
    assert.equal(twice.type, "not_found");
  });

  it("carries the item index so n8n can point at the row that failed", () => {
    for (const source of [new SpecError("bad"), new UpstreamError("endpoint failed", "socket hang up")])
      assert.equal(asNodeError(node, source, 3).context.itemIndex, 3, `${source.name} must carry the item index`);
  });
});

describe("n8n's own lint rules, pinned", () => {
  /*
   * These have no runtime effect, so nothing else would notice them being lost.
   * Their only other enforcement is n8n's cloud scanner, which runs after publish.
   */
  const REQUIRED_SENTENCE = 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>';

  it("gives every dynamic-option field the exact sentence n8n mandates", () => {
    const dynamic = [];
    const walk = (properties) => {
      for (const property of properties ?? []) {
        if (property.typeOptions?.loadOptionsMethod !== undefined) dynamic.push(property);
        for (const option of property.options ?? []) walk(option.values);
      }
    };
    walk(specProperties());

    assert.equal(dynamic.length, 4, "all four loadOptions fields must be reachable");
    for (const property of dynamic)
      assert.ok(property.description?.includes(REQUIRED_SENTENCE), `"${property.name}" is missing n8n's mandated sentence`);
  });

  it("declares whether each node may be used as an AI tool", () => {
    /*
     * The reads are safe for an agent; publishing to a public chain is not
     * something to hand one by default, so the tool description says so rather
     * than the node being flatly usable.
     */
    const asTool = new Hive().description.usableAsTool;
    assert.notEqual(asTool, true, "a node that can publish must not be a bare usableAsTool: true");
    assert.match(asTool.replacements.description, /refused when this node runs as a tool/);

    // The trigger is a stream, not a tool.
    assert.equal(new HiveTrigger().description.usableAsTool, undefined);
  });
});

describe("publishing as an AI tool", () => {
  /**
   * A stand-in for n8n's execute context.
   *
   * `credentialReads` is the assertion that matters: the refusal has to happen
   * above the posting key, not beside it.
   */
  const toolContext = ({ resource, tool, nodeType = "@hiveio/n8n-nodes-hive.hiveTool" }) => {
    const credentialReads = [];
    return {
      credentialReads,
      context: {
        getInputData: () => [{ json: {} }],
        getNode: () => ({ name: "Hive", type: nodeType, typeVersion: 1 }),
        isToolExecution: tool === undefined ? undefined : () => tool,
        continueOnFail: () => false,
        getCredentials: async (name) => {
          credentialReads.push(name);
          return { account: "alice", postingKey: "a-key-that-must-never-be-read" };
        },
        getNodeParameter: (name, _index, fallback) => {
          if (name === "resource") return resource;
          if (name === "operation") return resource === "comment" ? "reply" : "get";
          return fallback ?? "";
        },
      },
    };
  };

  it("refuses to publish when the node is executed as a tool", async () => {
    const { context, credentialReads } = toolContext({ resource: "comment", tool: true });

    await assert.rejects(
      () => Hive.prototype.execute.call(context),
      (error) => {
        assert.equal(error.type, "forbidden_as_tool");
        assert.match(error.message, /not available to an AI agent/);
        return true;
      },
    );

    assert.deepEqual(credentialReads, [], "the posting key must not even be read on the refused path");
  });

  it("refuses on the node-type suffix alone, for a host too old to report tool execution", async () => {
    // `n8n-workflow` is a `*` peer, so `isToolExecution` may be missing entirely.
    const { context, credentialReads } = toolContext({ resource: "comment", tool: undefined });

    await assert.rejects(() => Hive.prototype.execute.call(context), { type: "forbidden_as_tool" });
    assert.deepEqual(credentialReads, []);
  });

  it("leaves the reads alone -- they are the reason the node is a tool at all", async () => {
    const { context } = toolContext({ resource: "catalog", tool: true });

    const [items] = await Hive.prototype.execute.call(context);
    assert.equal(items.length, 1);
    assert.ok(Array.isArray(items[0].json.events), "the catalog must still be readable by an agent");
  });

  it("does not blame the Hive endpoint for a fault on this side", async () => {
    /*
     * `read()` wrapped everything the callback could raise as an UpstreamError,
     * and for resource: comment the callback is the whole of publishReply. An
     * empty Parent Permlink came back as "Hive endpoint ... failed" -- the wrong
     * system to debug, in the error class n8n's Retry on Fail keeps retrying.
     */
    const { context } = toolContext({ resource: "comment", tool: false, nodeType: "@hiveio/n8n-nodes-hive.hive" });
    context.getCredentials = async () => ({ postingKey: "not-a-key" });

    await assert.rejects(
      () => Hive.prototype.execute.call(context),
      (error) => {
        assert.notEqual(error.constructor.name, "NodeApiError", "a local fault must not be reported as an API failure");
        assert.ok(!/Hive endpoint .* failed/.test(error.message), `blamed the endpoint: ${error.message}`);
        return true;
      },
    );
  });

  it("still publishes in a plain workflow execution", async () => {
    /*
     * The guard keys on tool execution, not on the resource, so an ordinary
     * workflow must reach the credential exactly as before.
     */
    const { context, credentialReads } = toolContext({ resource: "comment", tool: false, nodeType: "@hiveio/n8n-nodes-hive.hive" });

    /*
     * It fails later, at the chain -- what matters is that it got past the guard.
     * No `hiveApi` is attached to the fake node, so the posting key is the only
     * credential this path reads.
     */
    await assert.rejects(() => Hive.prototype.execute.call(context));
    assert.deepEqual(credentialReads, ["hivePostingKey"], "the posting key is read on the allowed path");
  });
});

describe("reply permlinks", () => {
  const { derivePermlink } = shared("broadcast");

  it("never emits a character the chain rejects", () => {
    /*
     * Validate_permlink_0_1 allows lowercase letters, digits and hyphens only.
     * wax derives re-<parentAuthor>-<ts>, which is invalid the moment the parent
     * has a dot in its name -- and dotted names are ordinary on Hive.
     */
    for (const author of ["hive.fund", "peak.snaps", "neight.tester1", "UPPER.Case", "a..b", ".leading", "trailing."])
      assert.match(derivePermlink(author), /^[a-z0-9-]+$/, `"${author}" produced an invalid permlink`);
  });

  it("keeps the parent recognisable and stays unique", () => {
    assert.match(derivePermlink("hive.fund"), /^re-hive-fund-/);
    assert.notEqual(derivePermlink("gtg"), "re-gtg-");
  });
});

describe("the builder refuses what it used to silently reinterpret", () => {
  const builderValues = {
    specMode: "builder",
    events: { event: [{ event: "posts", joinWithPrevious: "or", parameters: { parameter: [{ name: "authors", value: "alice" }] } }] },
    providers: {},
    emitMode: "notification",
    specOptions: {},
  };
  const withEvents = (...events) => reader({ ...builderValues, events: { event: events } });
  const event = (tag, join, params = {}) => ({
    event: tag,
    joinWithPrevious: join,
    parameters: { parameter: Object.entries(params).map(([name, value]) => ({ name, value })) },
  });

  it("refuses a half-filled row instead of dropping its AND with it", () => {
    /*
     * The row was filtered out and took its joinWithPrevious with it, so the
     * neighbours re-joined under the *next* row's join:
     * posts(Or) / (unset)(And) / votes(Or) compiled to `posts OR votes` -- the
     * user wrote an AND and got a filter matching strictly more, with nothing
     * to see in the editor.
     */
    assert.throws(
      () =>
        buildSpec(
          withEvents(event("posts", "or", { authors: "alice" }), { joinWithPrevious: "and" }, event("votes", "or", { voters: "carol" })),
        ),
      (error) => error.code === "invalid_spec" && /row #2 has no event selected/.test(error.message),
    );
  });

  it("refuses a join it does not recognise instead of quietly widening to OR", () => {
    /*
     * JoinWithPrevious has no noDataExpression, so an expression can deliver
     * anything, and everything that was not exactly "and" fell through to OR.
     * emitMode is strict for this reason; the join was not.
     */
    for (const bad of ["AND", "And", "&&", "nor"])
      assert.throws(
        () => buildSpec(withEvents(event("posts", "or", { authors: "alice" }), event("votes", bad, { voters: "carol" }))),
        (error) => /is not a way to join two events/.test(error.message),
        `"${bad}" must not silently mean or`,
      );
  });

  it("still treats a missing join as Or, which is the field's default", () => {
    const noJoin = { event: "votes", parameters: { parameter: [{ name: "voters", value: "carol" }] } };
    const spec = buildSpec(withEvents(event("posts", "or", { authors: "alice" }), noJoin));
    assert.equal(spec.match.length, 1, "one OR group");
  });

  it("refuses an unusable Max Queue rather than serialising NaN", () => {
    assert.throws(
      () => buildSpec(reader({ ...builderValues, specOptions: { maxQueue: "lots" } })),
      (error) => /Max Queue must be a number/.test(error.message),
    );
  });
});
