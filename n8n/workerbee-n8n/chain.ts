/**
 * The part of a Hive chain WorkerBee uses, without wax and its WebAssembly: JSON-RPC calls with `fetch` and the few
 * computations of wax WorkerBee needs, written in JavaScript.
 *
 * Read only: broadcasting, ids of transactions and impacted accounts need wax (binary serialization of transactions
 * and the consensus rules of hived), so they fail with {@link WorkerBeeUnavailableError}.
 */
import type { NaiAsset } from "@hiveio/wax";
import { WorkerBeeError } from "../../packages/workerbee-core/src/errors";
import type { IWorkerBeeChain } from "../../packages/workerbee-core/src/interfaces";
import { transactionFromApi } from "./api-to-proto";
import { calculateCurrentManabarValue } from "./manabar";

/** The timeout of wax for a call of the API */
const API_TIMEOUT_MS = 2_000;

const HIVE_PRECISION = 3;

/** The configuration of mainnet, which wax has built in - WorkerBee reads this key only */
const CONFIG: IWorkerBeeChain["config"] = {
  HIVE_FEED_INTERVAL_BLOCKS: "1200"
};

export class WorkerBeeUnavailableError extends WorkerBeeError {
  public constructor(what: string) {
    super(`${what} needs wax (WebAssembly), which this build of WorkerBee leaves out`);
  }
}

export interface IJsonRpcChain extends IWorkerBeeChain {
  readonly endpoint: string;
}

const call = async(endpoint: string, method: string, params: unknown): Promise<unknown> => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  });
  if (!response.ok)
    throw new WorkerBeeError(`${method} failed with HTTP ${response.status} ${response.statusText}`);

  const body = await response.json() as { result?: unknown; error?: { message?: string } };
  if (body.error !== undefined)
    throw new WorkerBeeError(`${method} failed: ${body.error.message ?? JSON.stringify(body.error)}`);
  if (!("result" in body))
    throw new WorkerBeeError(`${method} returned no result`);

  return body.result;
};

/**
 * `hiveCoins` of wax: the amount of HIVE in the NAI form
 */
const hiveCoins = (amount: number): NaiAsset => {
  const [whole, fraction = ""] = amount.toString().split(".") as [string, string | undefined];

  return {
    amount: (BigInt(whole) * 10n ** BigInt(HIVE_PRECISION) + BigInt(fraction.substring(0, HIVE_PRECISION).padEnd(HIVE_PRECISION, "0"))).toString(),
    precision: HIVE_PRECISION,
    nai: "@@000000021"
  };
};

/**
 * The chain read from the API node at `endpoint` - nothing is sent before the first call
 */
export const createJsonRpcChain = (endpoint: string): IJsonRpcChain => {
  const method = (name: string) => (params: unknown) => call(endpoint, name, params);

  /*
   * The methods are typed by IWorkerBeeChain: each of them sends its parameters and returns the result of the node as
   * it is, which is what wax does for them too.
   */
  const api = {
    block_api: {
      get_block: method("block_api.get_block"),
      get_block_range: method("block_api.get_block_range")
    },
    database_api: {
      find_accounts: method("database_api.find_accounts"),
      find_change_recovery_account_requests: method("database_api.find_change_recovery_account_requests"),
      find_decline_voting_rights_requests: method("database_api.find_decline_voting_rights_requests"),
      find_witnesses: method("database_api.find_witnesses"),
      get_comment_pending_payouts: method("database_api.get_comment_pending_payouts"),
      get_dynamic_global_properties: method("database_api.get_dynamic_global_properties"),
      get_feed_history: method("database_api.get_feed_history")
    },
    rc_api: {
      find_rc_accounts: method("rc_api.find_rc_accounts")
    }
  } as unknown as IWorkerBeeChain["api"];

  return {
    endpoint,
    api,
    config: CONFIG,
    hiveCoins,
    calculateCurrentManabarValue,
    // WorkerBee reads the protobuf form only - the ids of the transactions of a block come with the block
    createTransactionFromJson: ((transactionData: string | object) => ({
      transaction: transactionFromApi(transactionData),
      get id(): string {
        throw new WorkerBeeUnavailableError("The id of a transaction");
      },
      get legacy_id(): string {
        throw new WorkerBeeUnavailableError("The id of a transaction");
      }
    })) as unknown as IWorkerBeeChain["createTransactionFromJson"],
    operationGetImpactedAccounts: () => {
      throw new WorkerBeeUnavailableError("Finding the accounts impacted by an operation");
    },
    broadcast: () => Promise.reject(new WorkerBeeUnavailableError("Broadcasting a transaction"))
  };
};
