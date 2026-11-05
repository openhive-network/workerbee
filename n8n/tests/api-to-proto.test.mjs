/*
 * The protobuf form of the transactions of real blocks, as the nodes build it
 * without WebAssembly, against what wax builds for the same transactions.
 *
 * The blocks are the API responses the library's own tests replay
 * (../__tests__/assets/api-recordings): every transaction of every recorded
 * `get_block` / `get_block_range` is converted both ways.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const { transactionFromApi } = await import("../dist/workerbee/index.mjs");

const RECORDINGS = fileURLToPath(new URL("../../__tests__/assets/api-recordings", import.meta.url));

const recordedFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? recordedFiles(join(dir, entry.name)) : entry.name.endsWith(".json.gz") ? [join(dir, entry.name)] : [],
  );

const recordedTransactions = () => {
  const transactions = [];
  for (const file of recordedFiles(RECORDINGS))
    for (const { request, response } of JSON.parse(gunzipSync(readFileSync(file)).toString())) {
      const result = response?.result;
      if (request.method === "block_api.get_block" && result?.block !== undefined) transactions.push(...result.block.transactions);
      if (request.method === "block_api.get_block_range") for (const block of result?.blocks ?? []) transactions.push(...block.transactions);
    }
  return transactions;
};

describe("transactionFromApi", () => {
  let chain;

  before(async () => {
    const wax = await import("@hiveio/wax");
    chain = await wax.createWaxFoundation();
  });

  after(() => chain?.delete());

  it("builds what wax builds for every recorded transaction", () => {
    const transactions = recordedTransactions();
    assert.ok(transactions.length > 1000, `expected a real sample, found ${transactions.length} transactions`);

    const kinds = new Set();
    for (const apiTransaction of transactions) {
      for (const operation of apiTransaction.operations) kinds.add(operation.type);
      assert.deepEqual(transactionFromApi(apiTransaction), chain.createTransactionFromJson(apiTransaction).transaction);
    }

    assert.ok(kinds.size > 10, `expected many kinds of operations, found ${[...kinds].join(", ")}`);
  });

  it("leaves the transaction it was given untouched", () => {
    const [apiTransaction] = recordedTransactions();
    const copy = structuredClone(apiTransaction);

    transactionFromApi(apiTransaction);

    assert.deepEqual(apiTransaction, copy);
  });

  it("converts the flat maps of authorities and witness properties the way wax does", () => {
    const apiTransaction = {
      ref_block_num: 1,
      ref_block_prefix: 2,
      expiration: "2026-11-05T12:00:00",
      extensions: [],
      signatures: [],
      operations: [
        {
          type: "account_update_operation",
          value: {
            account: "alice",
            owner: { weight_threshold: 1, account_auths: [["bob", 1]], key_auths: [["STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4", 1]] },
            memo_key: "STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4",
            json_metadata: "",
          },
        },
        {
          type: "witness_set_properties_operation",
          value: { owner: "alice", props: [["account_creation_fee", "b80b00000000000003535445454d0000"]], extensions: [] },
        },
        {
          type: "comment_options_operation",
          value: {
            author: "alice",
            permlink: "post",
            max_accepted_payout: { amount: "1000000000", precision: 3, nai: "@@000000013" },
            percent_hbd: 10000,
            allow_votes: true,
            allow_curation_rewards: true,
            extensions: [{ type: "comment_payout_beneficiaries", value: { beneficiaries: [{ account: "bob", weight: 100 }] } }],
          },
        },
      ],
    };

    assert.deepEqual(transactionFromApi(apiTransaction), chain.createTransactionFromJson(apiTransaction).transaction);
  });
});
