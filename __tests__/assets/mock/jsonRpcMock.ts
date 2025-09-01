import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import type { IJsonRpcMockData, TJsonRpcResponse } from "./api-mock";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global call counters for methods without parameters
const methodCallCounters: Record<string, number> = {};

export const resetMockCallCounters = (): void => {
  for (const key in methodCallCounters)
    delete methodCallCounters[key];
};

const loadMockDataForMethod = (method: string): Array<{ req: unknown; res: unknown }> => {
  const logPath = path.resolve(__dirname, "../api-call-logs", `${method.replace(/[^a-zA-Z0-9_]/g, "_")}.json`);

  if (fs.existsSync(logPath))
    try {
      const content = fs.readFileSync(logPath, "utf-8");
      const data = JSON.parse(content);

      if (Array.isArray(data))
        return data;
    } catch { /* Empty */ }

  return [];
};

const findMatchingResponse = (method: string, request: Record<string, unknown>): TJsonRpcResponse | void => {
  const mockData = loadMockDataForMethod(method);

  if (mockData.length === 0)
    return;

  // Special handling for methods without parameters - cycle through responses
  if (typeof request.params === "object" && request.params !== null && Object.keys(request.params).length === 0) {
    if (!(method in methodCallCounters))
      methodCallCounters[method] = 0;

    // Return the next response in sequence for methods without parameters
    const responseIndex = methodCallCounters[method] % mockData.length;
    methodCallCounters[method]++;

    return mockData[responseIndex]?.res as TJsonRpcResponse;
  }

  // Create a counter key for this specific request
  const requestKey = `${method}:${JSON.stringify(request.params)}`;

  // Find all matching entries for this method and params combination
  const matchingEntries = mockData.filter(entry => {
    if (typeof entry.req === "object" && entry.req !== null && "method" in entry.req && "params" in entry.req) {
      const entryReq = entry.req as Record<string, unknown>;
      return entryReq.method === request.method && JSON.stringify(entryReq.params) === JSON.stringify(request.params);
    }
    return false;
  });

  // If we have matching entries, cycle through them using a counter
  if (matchingEntries.length > 0) {
    if (!(requestKey in methodCallCounters))
      methodCallCounters[requestKey] = 0;

    const responseIndex = methodCallCounters[requestKey] % matchingEntries.length;
    methodCallCounters[requestKey]++;

    return matchingEntries[responseIndex]?.res as TJsonRpcResponse;
  }

  // If no match found, return undefined to let proxy server forward to real API
};

export default {
  "database_api.find_accounts": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("database_api.find_accounts", request);
  },

  "block_api.get_block_range": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("block_api.get_block_range", request);
  },

  "block_api.get_block": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("block_api.get_block", request);
  },

  "database_api.get_dynamic_global_properties": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("database_api.get_dynamic_global_properties", request);
  },

  "database_api.find_witnesses": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("database_api.find_witnesses", request);
  },

  "database_api.get_feed_history": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("database_api.get_feed_history", request);
  },

  "rc_api.find_rc_accounts": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("rc_api.find_rc_accounts", request);
  },

  "network_broadcast_api.broadcast_transaction": (request: Record<string, unknown>): TJsonRpcResponse | void => {
    return findMatchingResponse("network_broadcast_api.broadcast_transaction", request);
  }
} satisfies IJsonRpcMockData;
