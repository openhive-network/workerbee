/*
 * The chain of the nodes against a local JSON-RPC node: what it sends, what it
 * returns, and what it refuses to do without WebAssembly.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";

const { createJsonRpcChain, WorkerBeeUnavailableError } = await import("../dist/workerbee/index.mjs");

describe("the JSON-RPC chain", () => {
  const requests = [];
  let server;
  let endpoint;

  before(async () => {
    server = createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const call = JSON.parse(body);
        requests.push(call);
        response.setHeader("Content-Type", "application/json");
        if (call.method === "database_api.find_accounts")
          response.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32003, message: "Assert Exception: no such thing" }, id: call.id }));
        else response.end(JSON.stringify({ jsonrpc: "2.0", result: { method: call.method, params: call.params }, id: call.id }));
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    endpoint = `http://127.0.0.1:${server.address().port}/`;
  });

  after(() => server.close());

  it("sends nothing until it is called", () => {
    createJsonRpcChain(endpoint);
    assert.equal(requests.length, 0);
  });

  it("calls the method of the API by its name and returns the result as it is", async () => {
    const chain = createJsonRpcChain(endpoint);

    const result = await chain.api.block_api.get_block_range({ starting_block_num: 5, count: 2 });

    assert.deepEqual(result, { method: "block_api.get_block_range", params: { starting_block_num: 5, count: 2 } });
    assert.deepEqual(requests.at(-1), { jsonrpc: "2.0", method: "block_api.get_block_range", params: { starting_block_num: 5, count: 2 }, id: 1 });
  });

  it("throws the error the node returned", async () => {
    const chain = createJsonRpcChain(endpoint);

    await assert.rejects(chain.api.database_api.find_accounts({ accounts: ["alice"] }), /database_api\.find_accounts failed: Assert Exception: no such thing/);
  });

  it("gives the protobuf form of a transaction, but neither its id nor the impacted accounts", () => {
    const chain = createJsonRpcChain(endpoint);
    const transaction = chain.createTransactionFromJson({ operations: [{ type: "vote_operation", value: { voter: "alice" } }] });

    assert.deepEqual(transaction.transaction, { operations: [{ vote_operation: { voter: "alice" } }] });
    assert.throws(() => transaction.id, WorkerBeeUnavailableError);
    assert.throws(() => chain.operationGetImpactedAccounts({}), WorkerBeeUnavailableError);
  });

  it("refuses to broadcast", async () => {
    await assert.rejects(createJsonRpcChain(endpoint).broadcast({}), WorkerBeeUnavailableError);
  });

  it("counts HIVE the way wax does", () => {
    const chain = createJsonRpcChain(endpoint);

    assert.deepEqual(chain.hiveCoins(0), { amount: "0", precision: 3, nai: "@@000000021" });
    assert.deepEqual(chain.hiveCoins(1.5), { amount: "1500", precision: 3, nai: "@@000000021" });
    assert.deepEqual(chain.hiveCoins(12.3456), { amount: "12345", precision: 3, nai: "@@000000021" });
  });
});
