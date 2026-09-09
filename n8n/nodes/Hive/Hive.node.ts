/**
 * Hive -- the request/response half: chain reads, the catalog, and a preview of
 * the spec the visual builder produces.
 *
 * Every operation goes straight to a wax chain from the shared pool, so an
 * action node and a trigger watching the same endpoint share one connection.
 * Chain data is normalised on the way out (see `shared/normalize.ts`), which is
 * what makes `{{ $json.account.balance.amount }}` behave in an n8n expression.
 */
import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, NodeConnectionType } from "n8n-workflow";
import { isToolType } from "n8n-workflow";

import { signer } from "../shared/broadcast";
import { catalogCopy } from "../shared/catalog";
import { botPool, DEFAULT_ENDPOINT } from "../shared/chain";
import { resolveChainId, resolveEndpoint } from "../shared/credentials";
import { CredentialError, HiveNodeError, NotFoundError, UpstreamError } from "../shared/errors";
import { loadOptions } from "../shared/load-options";
import { asNodeError } from "../shared/node-errors";
import { normalizeJson } from "../shared/normalize";
import { specProperties } from "../shared/properties";
import { buildJsonSchema } from "../shared/schema";
import { buildSpec } from "../shared/spec";
import { subscribedNodes } from "../shared/subscriptions";
import type { IHiveChainInterface } from "../shared/wax-types";

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
     * Every read here is safe for an agent to call: no chain state changes and
     * nothing is spent. `Comment: Reply` is the exception, and it is refused at
     * runtime in `runOne` -- not by this line. `replacements` cannot restrict
     * anything: `INodeTypeBaseDescription` has no `properties` to override, and
     * n8n merges the replacement only when it builds the editor's node list
     * (`tool-generation/ai-tools.js`), never on the execution path. So this
     * string describes the guard; it is not the guard. The trigger is not a tool
     * at all: it is a stream.
     */
    usableAsTool: {
      replacements: {
        description:
          "Read Hive chain data: accounts, blocks, chain status, the event catalog and subscription specs. " +
          "Publishing a comment is refused when this node runs as a tool.",
      },
    },
    defaults: { name: "Hive" },
    inputs: ["main" as NodeConnectionType],
    outputs: ["main" as NodeConnectionType],
    credentials: [
      { name: "hiveApi", required: false },
      /*
       * Only the writing operation asks for a key, so every other workflow runs
       * with no secret attached at all.
       */
      { name: "hivePostingKey", required: true, displayOptions: { show: { resource: ["comment"] } } },
    ],
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
          { name: "Comment", value: "comment" },
          { name: "Spec", value: "spec" },
        ],
        default: "chain",
      },
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: { show: { resource: ["comment"] } },
        options: [
          {
            name: "Reply",
            value: "reply",
            description: "Sign and broadcast a reply to a post or comment. This writes to the blockchain and cannot be undone",
            action: "Publish a reply",
          },
        ],
        default: "reply",
      },
      {
        displayName: "Parent Author",
        name: "parentAuthor",
        type: "string",
        default: "",
        required: true,
        placeholder: "hiveio",
        displayOptions: { show: { resource: ["comment"] } },
        description: "Author of the post or comment being replied to, without the leading @",
      },
      {
        displayName: "Parent Permlink",
        name: "parentPermlink",
        type: "string",
        default: "",
        required: true,
        displayOptions: { show: { resource: ["comment"] } },
        description: "Permlink of the post or comment being replied to",
      },
      {
        displayName: "Body",
        name: "body",
        type: "string",
        typeOptions: { rows: 4 },
        default: "",
        required: true,
        displayOptions: { show: { resource: ["comment"] } },
        description: "The reply itself, as Markdown",
      },
      {
        displayName: "Reply Options",
        name: "replyOptions",
        type: "collection",
        placeholder: "Add Option",
        default: {},
        displayOptions: { show: { resource: ["comment"] } },
        options: [
          {
            displayName: "Permlink",
            name: "permlink",
            type: "string",
            default: "",
            description:
              "The reply's own permlink. Left empty, one is derived from the parent and the clock; " +
              "supply it only to make a retry land on the same comment instead of creating a second one.",
          },
          {
            displayName: "Title",
            name: "title",
            type: "string",
            default: "",
            description: "Replies normally have no title. Front ends ignore it",
          },
        ],
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

    for (let index = 0; index < items.length; index++)
      try {
        for (const json of await runOne(this, index)) results.push({ json, pairedItem: { item: index } });
      } catch (error) {
        /*
         * A catch-all: the operations below already throw n8n's error types, but
         * anything raised deeper -- by `nodes/shared/*`, which has no INode and
         * whose tests never build one -- arrives here as a package error still.
         */
        if (!this.continueOnFail()) throw asNodeError(this.getNode(), error, index);
        results.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
      }


    return [results];
  }
}

async function runOne(context: IExecuteFunctions, index: number): Promise<IDataObject[]> {
  const resource = context.getNodeParameter("resource", index) as string;
  const operation = context.getNodeParameter("operation", index) as string;

  /*
   * The one place that can actually keep the tool description's promise, sitting
   * above the credential read rather than beside it.
   *
   * Two signals because `n8n-workflow` is a `*` peer: `isToolExecution` is the
   * documented one (`FunctionsBase`), and the node-type suffix is the convention
   * n8n itself uses to resolve the synthetic tool type. `noDataExpression` on
   * Resource is not a third: n8n deliberately preserves a lone `$fromAI()` on
   * such fields, so an agent can be handed the resource selector itself.
   */
  const asTool = (typeof context.isToolExecution === "function" && context.isToolExecution()) || isToolType(context.getNode().type);
  if (asTool && resource === "comment")
    throw asNodeError(
      context.getNode(),
      new HiveNodeError(
        "Publishing to Hive is not available to an AI agent",
        "forbidden_as_tool",
        "A comment cannot be edited or deleted once it is in a block. Use the Hive node in the workflow itself rather than attaching it to an agent.",
      ),
      index,
    );

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
   * Only signing needs it, but the pool caches one chain per endpoint, so it has
   * to be known before the first read opens that chain.
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
  const read = async <T>(request: (chain: IHiveChainInterface) => Promise<T>): Promise<T> => {
    try {
      return await botPool.withChain(endpoint, request, chainId);
    } catch (error) {
      /*
       * Anything this package already classified is passed through: the pool
       * reports a failure to connect against the endpoint itself, and the signer
       * reports an unusable credential as one. Only an unrecognised throw is
       * attributed to the endpoint.
       *
       * It used to be `instanceof UpstreamError`, which swept up everything the
       * callback could raise -- and for `resource: comment` the callback is the
       * whole of publishReply. An empty Parent Permlink came back as "Hive
       * endpoint https://api.hive.blog/ failed", pointing the user at a healthy
       * node, in the error class n8n's Retry on Fail is built for: it would
       * retry, for ever, a request that could never succeed.
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
  case "comment": {
    /*
     * Checked, unlike the read resources: this is the one branch that writes to
     * a blockchain, and a stale `operation` on an imported workflow must not
     * fall through to publishing.
     */
    if (operation !== "reply")
      throw asNodeError(context.getNode(), new HiveNodeError(`Unsupported comment operation "${operation}"`, "invalid_request"), index);

    /*
     * The only operation in this package that changes the chain. The key comes
     * from its own credential, is passed straight to the signer, and is never
     * put into an item, a log line or an error.
     */
    const key = await context.getCredentials<{ account?: string; postingKey?: string }>("hivePostingKey");
    const options = context.getNodeParameter("replyOptions", index, {}) as { permlink?: string; title?: string };

    /*
     * Asked for rather than assumed. A credential saved before the `account`
     * field existed, or hand-edited through the API, has no `account` at all,
     * and `key.account.trim()` on it threw a bare TypeError from inside the
     * pooled read -- which reported it as the Hive endpoint failing.
     */
    const account = (key.account ?? "").trim();
    const postingKey = key.postingKey ?? "";
    if (account === "" || postingKey === "")
      throw asNodeError(
        context.getNode(),
        new CredentialError("The Hive Posting Key credential is incomplete", "It needs both an account name and a posting key. Open it and fill both in."),
        index,
      );

    const parentAuthor = (context.getNodeParameter("parentAuthor", index) as string).trim().replace(/^@/, "");
    const parentPermlink = (context.getNodeParameter("parentPermlink", index) as string).trim();
    const body = context.getNodeParameter("body", index) as string;

    /*
     * These are `required` in the editor, but an expression can still resolve
     * to nothing. wax rejects them deep inside WebAssembly with a message that
     * names neither the node nor the field.
     */
    for (const [label, value] of [
      ["Parent Author", parentAuthor],
      ["Parent Permlink", parentPermlink],
      ["Body", body],
    ] as const)
      if (value.trim() === "")
        throw asNodeError(
          context.getNode(),
          new HiveNodeError(`${label} is empty`, "invalid_request", "A reply needs all three of Parent Author, Parent Permlink and Body."),
          index,
        );

    const published = await read((chain) =>
      signer.publishReply(chain, endpoint, {
        account,
        postingKey,
        parentAuthor,
        parentPermlink,
        body,
        ...(options.permlink ? { permlink: options.permlink } : {}),
        ...(options.title ? { title: options.title } : {}),
      }),
    );

    return [{ endpoint, ...published }];
  }
  default:
    throw asNodeError(context.getNode(), new HiveNodeError(`Unsupported resource "${resource}"`, "invalid_request"), index);
  }
}

