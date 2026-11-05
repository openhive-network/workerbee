/**
 * Hive -- the request/response half: chain reads, the catalog, and a preview of
 * the spec the visual builder produces.
 *
 * Every operation goes straight to a chain from the shared pool, so an action
 * node and a trigger watching the same endpoint share one connection. Chain data
 * is normalised on the way out (see `shared/normalize.ts`), which is what makes
 * `{{ $json.account.balance.amount }}` behave in an n8n expression.
 *
 * Read only: publishing (`Comment: Reply`) needs wax and its WebAssembly, which
 * this package leaves out to have no runtime dependencies.
 */
import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, NodeConnectionType } from "n8n-workflow";

import { catalogCopy } from "../../shared/catalog";
import { botPool, DEFAULT_ENDPOINT } from "../../shared/chain";
import { resolveChainId, resolveEndpoint } from "../../shared/credentials";
import { HiveNodeError, NotFoundError, UpstreamError } from "../../shared/errors";
import { loadOptions } from "../../shared/load-options";
import { asNodeError } from "../../shared/node-errors";
import { normalizeJson } from "../../shared/normalize";
import { specProperties } from "../../shared/properties";
import { buildJsonSchema } from "../../shared/schema";
import { buildSpec } from "../../shared/spec";
import { subscribedNodes } from "../../shared/subscriptions";
import type { IJsonRpcChain } from "../../workerbee/n8n/workerbee-n8n/index";

const specOnly = { show: { resource: ["spec"], operation: ["preview"] } };

export class Hive implements INodeType {
  public description: INodeTypeDescription = {
    displayName: "Hive",
    name: "hive",
    icon: "file:hive.svg",
    group: ["input"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "Read Hive chain data and build subscription specs with WorkerBee",
    /*
     * Every operation here is safe for an agent to call: no chain state changes
     * and nothing is spent. The trigger is not a tool at all: it is a stream.
     */
    usableAsTool: {
      replacements: {
        description: "Read Hive chain data: accounts, blocks, chain status, the event catalog and subscription specs.",
      },
    },
    defaults: { name: "Hive" },
    inputs: ["main" as NodeConnectionType],
    outputs: ["main" as NodeConnectionType],
    credentials: [{ name: "hiveApi", required: false }],
    // The spec builder is a three-column form; the default pane crops it.
    parameterPane: "wide",
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Account", value: "account" },
          { name: "Block", value: "block" },
          { name: "Catalog", value: "catalog" },
          { name: "Chain", value: "chain" },
          { name: "Spec", value: "spec" },
        ],
        default: "chain",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["account"] } },
        options: [{ name: "Get", value: "get", description: "Fetch full account state", action: "Get an account" }],
        default: "get",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["block"] } },
        options: [{ name: "Get", value: "get", description: "Fetch one block with its transactions", action: "Get a block" }],
        default: "get",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["chain"] } },
        options: [
          { name: "Get Status", value: "get", description: "Head block number, ID and chain time", action: "Get chain status" },
          { name: "Get Health", value: "getHealth", description: "Which endpoints this n8n currently keeps open", action: "Get observer health" },
        ],
        default: "get",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["catalog"] } },
        options: [
          { name: "Get Events", value: "getEvents", description: "Every event and provider the trigger can watch", action: "Get the event catalog" },
          { name: "Get Schema", value: "getSchema", description: "JSON Schema of the spec and of every emitted item", action: "Get the JSON schema" },
        ],
        default: "getEvents",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["spec"] } },
        options: [
          {
            name: "Preview",
            value: "preview",
            description: "Compile the visual builder into the JSON the trigger's Raw JSON field accepts",
            action: "Preview a subscription spec",
          },
        ],
        default: "preview",
      },
      {
        displayName: "Account",
        name: "accountName",
        type: "string",
        default: "",
        required: true,
        placeholder: "hiveio",
        displayOptions: { show: { resource: ["account"] } },
        description: "Hive account name to look up",
      },
      {
        displayName: "Block Number",
        name: "blockNumber",
        type: "number",
        typeOptions: { minValue: 1 },
        default: 1,
        required: true,
        displayOptions: { show: { resource: ["block"] } },
        description: "Block to fetch, by height",
      },
      {
        displayName: "Hive API Endpoint",
        name: "endpoint",
        type: "string",
        default: "",
        placeholder: DEFAULT_ENDPOINT,
        displayOptions: { show: { resource: ["account", "block", "chain"], operation: ["get"] } },
        description: "Overrides the Hive node from the credential, for this call only",
      },
      ...specProperties(specOnly),
    ],
  };

  public methods = { loadOptions };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const results: INodeExecutionData[] = [];

    // In braces: n8n's verification lint crashes on a loop body that is a bare `try`
    // eslint-disable-next-line curly
    for (let index = 0; index < items.length; index++) {
      try {
        for (const json of await runOne(this, index)) results.push({ json, pairedItem: { item: index } });
      } catch (error) {
        /*
         * A catch-all: the operations below already throw n8n's error types, but
         * anything raised deeper -- by `shared/*`, which has no INode and
         * whose tests never build one -- arrives here as a package error still.
         */
        if (!this.continueOnFail()) throw asNodeError(this.getNode(), error, index);
        results.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
      }
    }

    return [results];
  }
}

async function runOne(context: IExecuteFunctions, index: number): Promise<IDataObject[]> {
  const resource = context.getNodeParameter("resource", index) as string;
  const operation = context.getNodeParameter("operation", index) as string;

  if (resource === "catalog") return [operation === "getSchema" ? (buildJsonSchema() as IDataObject) : (catalogCopy() as unknown as IDataObject)];

  if (resource === "spec") {
    const spec = buildSpec((name, fallback) => context.getNodeParameter(name, index, fallback));
    return [spec as unknown as IDataObject];
  }

  if (resource === "chain" && operation === "getHealth")
    return [
      {
        status: "ok",
        defaultEndpoint: DEFAULT_ENDPOINT,
        endpoints: botPool.endpoints,
        polling: botPool.polling,
        bots: botPool.size,
        /*
         * One entry per subscribed trigger. Two entries for one node would mean
         * a duplicate subscription, which used to be visible only as a second
         * "watching" line in the log with no matching "stopped".
         */
        subscriptions: subscribedNodes(),
      },
    ];

  const endpoint = await resolveEndpoint(context, context.getNodeParameter("endpoint", index, "") as string);
  /*
   * Only signing needs it, which this build leaves out, but the pool caches one
   * chain per endpoint, so it has to be known before the first read opens that
   * chain.
   */
  const chainId = await resolveChainId(context);

  /**
   * One pooled read. The pool owns the chain for the duration of the call, so it
   * cannot be evicted and freed while the request is in flight.
   *
   * A closure rather than a free function: `endpoint`, `context` and `index` are
   * all in scope here, and passing only some of them was how upstream failures
   * ended up as the one error shape that could not say which item produced it.
   */
  const read = async <T>(request: (chain: IJsonRpcChain) => Promise<T>): Promise<T> => {
    try {
      return await botPool.withChain(endpoint, request, chainId);
    } catch (error) {
      /*
       * Anything this package already classified is passed through: the pool
       * reports a failure to connect against the endpoint itself. Only an
       * unrecognised throw is attributed to the endpoint.
       */
      const failure = error instanceof HiveNodeError ? error : new UpstreamError(`Hive endpoint ${endpoint} failed`, (error as Error).message, error);
      throw asNodeError(context.getNode(), failure, index);
    }
  };

  switch (resource) {
  case "chain": {
    const dgp = await read((chain) => chain.api.database_api.get_dynamic_global_properties({}));
    return [{ endpoint, headBlockNumber: dgp.head_block_number, headBlockId: String(dgp.head_block_id), time: String(dgp.time) }];
  }
  case "account": {
    const name = context.getNodeParameter("accountName", index) as string;
    const found = await read((chain) => chain.api.database_api.find_accounts({ accounts: [name] }));
    const account = found.accounts?.[0];
    if (account === undefined) throw asNodeError(context.getNode(), new NotFoundError(`No such account "${name}"`), index);
    return [{ endpoint, name, account: normalizeJson(account) as IDataObject }];
  }
  case "block": {
    const blockNum = context.getNodeParameter("blockNumber", index) as number;
    const result = await read((chain) => chain.api.block_api.get_block({ block_num: blockNum }));
    const block = result.block;
    if (block === undefined || block === null) throw asNodeError(context.getNode(), new NotFoundError(`Block ${blockNum} is not available`), index);
    return [{ endpoint, blockNum, block: normalizeJson(block) as IDataObject }];
  }
  default:
    throw asNodeError(context.getNode(), new HiveNodeError(`Unsupported resource "${resource}"`, "invalid_request"), index);
  }
}

