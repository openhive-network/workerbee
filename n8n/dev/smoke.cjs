/**
 * End-to-end smoke test against a live Hive node.
 *
 * Drives the *installed* classes through fake n8n execution contexts: the action
 * node's operations, then the trigger, from activation to first items to a clean
 * close. Unit tests cover the logic; this proves the wiring -- the CommonJS node
 * really can load the ESM WorkerBee bundle, the chain really connects, and the
 * observer really produces items.
 *
 *   docker exec -i hive-n8n-test node - < n8n/dev/smoke.cjs
 *
 * Point it at another package copy or endpoint with:
 *   HIVE_NODES=/path/to/package HIVE_ENDPOINT=https://api.hive.blog/
 */
const PACKAGE = process.env.HIVE_NODES ?? "/home/node/.n8n/nodes/node_modules/@hiveio/n8n-nodes-hive";
const ENDPOINT = process.env.HIVE_ENDPOINT ?? "https://api.hive.blog/";
const BLOCK_TIMEOUT_MS = Number(process.env.HIVE_TIMEOUT_MS ?? 60000);

const { Hive } = require(`${PACKAGE}/dist/nodes/Hive/Hive.node.js`);
const { HiveTrigger } = require(`${PACKAGE}/dist/nodes/HiveTrigger/HiveTrigger.node.js`);
const { botPool } = require(`${PACKAGE}/dist/nodes/shared/chain.js`);

let failures = 0;

const check = (label, condition, detail) => {
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${detail === undefined ? "" : ` -- ${detail}`}`);
  if (!condition) failures += 1;
};

const logger = { info: () => {}, warn: (message) => console.log(`     warn: ${message}`), error: console.error, debug: () => {} };

/** The slice of IExecuteFunctions the action node touches. */
function executeContext(parameters) {
  return {
    logger,
    getInputData: () => [{ json: {} }],
    getNode: () => ({ name: "Hive", type: "hive" }),
    getWorkflow: () => ({ id: "smoke" }),
    // No credential attached, which is the out-of-the-box case.
    getCredentials: async () => {
      throw new Error("no credentials");
    },
    getNodeParameter: (name, _index, fallback) => (name in parameters ? parameters[name] : fallback),
    continueOnFail: () => false,
    helpers: { returnJsonArray: (items) => items.map((json) => ({ json })) },
  };
}

async function runAction(parameters) {
  const [items] = await new Hive().execute.call(executeContext(parameters));
  return items.map((item) => item.json);
}

async function actionNode() {
  const [catalog] = await runAction({ resource: "catalog", operation: "getEvents" });
  check("catalog lists 25 events and 7 providers", catalog.events.length === 25 && catalog.providers.length === 7,
    `${catalog.events.length}/${catalog.providers.length}`);

  const [schema] = await runAction({ resource: "catalog", operation: "getSchema" });
  check("schema describes the spec and both item shapes",
    schema.components.schemas.SubscriptionSpec !== undefined && schema.components.schemas.EmittedItem.oneOf.length === 2);

  const [spec] = await runAction({
    resource: "spec",
    operation: "preview",
    specMode: "builder",
    emitMode: "operation",
    events: { event: [{ event: "posts", joinWithPrevious: "or", parameters: { parameter: [{ name: "authors", value: "alice,bob" }] } }] },
  });
  check("spec preview compiles the builder into raw JSON", spec.match[0][0].event === "posts" && spec.mode === "operation", JSON.stringify(spec));

  const [status] = await runAction({ resource: "chain", operation: "get", endpoint: ENDPOINT });
  check("chain status reads the head block", Number(status.headBlockNumber) > 0, `#${status.headBlockNumber} at ${status.time}`);

  const [account] = await runAction({ resource: "account", operation: "get", accountName: "hiveio", endpoint: ENDPOINT });
  check("account lookup returns normalised chain data", account.account?.name === "hiveio", `created ${account.account?.created}`);

  const [block] = await runAction({ resource: "block", operation: "get", blockNumber: Number(status.headBlockNumber) - 10, endpoint: ENDPOINT });
  check("block lookup returns a block with transactions", Array.isArray(block.block?.transactions), `${block.block?.transactions?.length} tx`);

  const [health] = await runAction({ resource: "chain", operation: "getHealth" });
  check("health reports the shared pool", health.bots >= 1 && health.endpoints.includes(ENDPOINT), JSON.stringify(health.endpoints));

  /*
   * A name Hive will accept syntactically (max 16 chars) but that does not exist,
   * so the failure comes back as an empty result rather than a protocol assert.
   */
  await runAction({ resource: "account", operation: "get", accountName: "nosuchacct12345", endpoint: ENDPOINT }).then(
    () => check("missing account is an error", false),
    /*
     * `type`, not `code`: errors are translated into n8n's own classes at the node
     * boundary (nodes/shared/node-errors.ts), and `type` is where n8n keeps the
     * machine-readable classification a workflow branches on.
     */
    (error) => check("missing account is a not_found error", error.type === "not_found", `${error.constructor.name}: ${error.message}`),
  );
}

/** The slice of ITriggerFunctions the trigger touches. */
function triggerContext(parameters, onEmit) {
  return {
    logger,
    getNode: () => ({ name: "Hive Trigger", type: "hiveTrigger" }),
    getWorkflow: () => ({ id: "smoke" }),
    getCredentials: async () => {
      throw new Error("no credentials");
    },
    getNodeParameter: (name, fallback) => (name in parameters ? parameters[name] : fallback),
    emit: (data) => onEmit(data),
    emitError: (error) => console.error("emitError:", error.message),
    helpers: { returnJsonArray: (items) => items.map((json) => ({ json })) },
  };
}

async function triggerNode() {
  const received = [];
  let resolveTwo;
  const gotTwo = new Promise((resolve) => {
    resolveTwo = resolve;
  });

  const context = triggerContext(
    {
      specMode: "json",
      specJson: JSON.stringify({ match: [[{ event: "block" }]], endpoint: ENDPOINT }),
      emitMode: "notification",
      specOptions: {},
    },
    (data) => {
      received.push(data[0][0].json);
      if (received.length >= 2) resolveTwo();
    },
  );

  const response = await new HiveTrigger().trigger.call(context);
  check("trigger activates and returns a close function", typeof response.closeFunction === "function");

  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`no block within ${BLOCK_TIMEOUT_MS}ms`)), BLOCK_TIMEOUT_MS).unref());
  try {
    await Promise.race([gotTwo, timeout]);
    const [first, second] = received;
    check("emits one item per block", received.length >= 2, `blocks ${first.blockNum} then ${second.blockNum}`);
    check("items are sequenced", second.seq === first.seq + 1, `${first.seq} -> ${second.seq}`);
    check("items carry the block header the observer provided", typeof first.payload?.block?.witness === "string", first.payload?.block?.witness);
  } catch (error) {
    check("emits items from the live chain", false, error.message);
  } finally {
    await response.closeFunction();
  }
}

(async () => {
  console.log(`smoke: ${PACKAGE}\n       ${ENDPOINT}\n`);
  await actionNode();
  console.log("");
  await triggerNode();
  botPool.closeAll();
  console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
