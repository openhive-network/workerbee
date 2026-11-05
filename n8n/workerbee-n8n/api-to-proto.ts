/**
 * Transactions of the API in the protobuf form WorkerBee reads - without the WebAssembly of wax.
 *
 * Mirrors `cpp::to_proto_visitor` of wax (`core/proto_converter.hpp`), which is structural only:
 * - a static variant `{ type, value }` (an operation, an extension) becomes `{ [type]: value }`,
 * - the flat maps `account_auths`, `key_auths` (authority) and `props` (witness_set_properties) become objects instead
 *   of arrays of pairs,
 * - everything else, assets in the NAI form included, passes unchanged.
 *
 * `tests/api-to-proto.test.mjs` compares it with wax on the transactions of the recorded blocks.
 */
import type { ApiTransaction, transaction } from "@hiveio/wax";

type TJson = null | boolean | number | string | TJson[] | { [key: string]: TJson };

type TJsonObject = { [key: string]: TJson };

const MAP_FIELDS = new Set(["account_auths", "key_auths", "props"]);

const isVariant = (value: TJsonObject): value is { type: string; value: TJson } =>
  typeof value.type === "string" && "value" in value && Object.keys(value).length === 2;

const toProto = (value: TJson): TJson => {
  if (Array.isArray(value))
    return value.map(toProto);

  if (value === null || typeof value !== "object")
    return value;

  if (isVariant(value))
    return { [value.type]: toProto(value.value) };

  const result: TJsonObject = {};
  for (const [key, field] of Object.entries(value))
    result[key] = MAP_FIELDS.has(key) && Array.isArray(field)
      ? Object.fromEntries((field as [string, TJson][]).map(([mapKey, mapValue]) => [mapKey, mapValue]))
      : toProto(field);

  return result;
};

export const transactionFromApi = (apiTransaction: string | object | ApiTransaction): transaction =>
  toProto((typeof apiTransaction === "string" ? JSON.parse(apiTransaction) : apiTransaction) as TJson) as unknown as transaction;
