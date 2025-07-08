import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import type { IJsonRpcMockData } from "./api-mock";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const callIndexes: Record<string, number> = {};

const getNextMockedResponse = (method: string): unknown => {
  const logPath = path.resolve(__dirname, "../api-call-logs", `${method.replace(/[^a-zA-Z0-9_]/g, "_")}.json`);

  if (fs.existsSync(logPath)) {
    const arr = JSON.parse(fs.readFileSync(logPath, "utf-8"));

    if (!Array.isArray(arr) || arr.length === 0)
      return;

    if (!(method in callIndexes))
      callIndexes[method] = 0;

    const idx = callIndexes[method];
    const entry = arr[idx] || arr[arr.length - 1];

    callIndexes[method]++;

    return entry?.res;
  }
};

export const resetCallIndexes = (): void => {
  for (const key in callIndexes)
    delete callIndexes[key];

};

export default {
  "database_api.find_accounts": (): unknown => {
    return getNextMockedResponse("database_api.find_accounts");
  },

  "block_api.get_block_range": (): unknown => {
    return getNextMockedResponse("block_api.get_block_range");
  },

  "block_api.get_block": (): unknown => {
    return getNextMockedResponse("block_api.get_block");
  },

  "database_api.get_dynamic_global_properties": (): unknown => {
    return getNextMockedResponse("database_api.get_dynamic_global_properties");
  },

  "network_broadcast_api.broadcast_transaction": (): unknown => {
    return getNextMockedResponse("network_broadcast_api.broadcast_transaction");
  }
} satisfies IJsonRpcMockData;
