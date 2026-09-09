import type { ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

/**
 * Which Hive node to talk to.
 *
 * No keys and no secrets live here -- the signing key has its own credential,
 * `HivePostingKey`, and this one is attached to workflows that never publish.
 * The credential exists so a whole n8n instance can point at one API node (a
 * private one, a testnet) in a single place, and it is optional: a node with no
 * credential falls back to the public default.
 *
 * Note that the endpoint is echoed into output items, log lines and error
 * messages, so `normalizeEndpoint` strips any userinfo from it before use.
 */
export class HiveApi implements ICredentialType {
  public name = "hiveApi";

  public displayName = "Hive API";

  public documentationUrl = "https://gitlab.syncad.com/hive/workerbee/-/tree/develop/n8n";

  public properties: INodeProperties[] = [
    {
      displayName: "API Endpoint",
      name: "endpoint",
      type: "string",
      default: "https://api.hive.blog/",
      required: true,
      placeholder: "https://api.hive.blog/",
      description: "Hive API node used for both block streaming and one-off queries. One block stream is shared per endpoint across the whole n8n instance.",
    },
    {
      displayName: "Chain ID",
      name: "chainId",
      type: "string",
      default: "",
      placeholder: "leave empty for Hive mainnet",
      description:
        "Only for a testnet or a mirrornet. A signature is computed over the chain ID, so publishing to one signs with the wrong chain " +
        'unless this is set -- the node then rejects a perfectly good key with "missing required posting authority". ' +
        "Reading is unaffected, which is why the mistake only shows up on the first broadcast.",
    },
  ];

  /**
   * The cheapest call every Hive node answers, so the Test button checks the URL
   * rather than only that something is listening.
   *
   * No `responseSuccessBody` rule: those fire when a key *equals* a value, and
   * the interesting case here is a key being *present* (`error`). Written as
   * `{key: "error", value: undefined}` the rule would match every successful
   * response and report a failure on a perfectly good endpoint.
   */
  public test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.endpoint}}",
      url: "",
      method: "POST",
      body: { jsonrpc: "2.0", id: 1, method: "database_api.get_dynamic_global_properties", params: {} },
    },
  };
}
