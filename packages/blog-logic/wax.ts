import {
  createHiveChain,
  type TWaxExtended,
  type TWaxRestExtended
} from "@hiveio/wax";
import HafbeExtendedData from "@hiveio/wax-api-hafbe";
import WaxExtendedData from "@hiveio/wax-api-jsonrpc";
import { WorkerBeeError } from "./errors";

export type WaxExtendedChain = TWaxExtended<typeof WaxExtendedData, TWaxRestExtended<typeof HafbeExtendedData>>;

// Default fallback API endpoints (ordered by preference)
const DEFAULT_ENDPOINTS = [
  "https://api.syncad.com",
  "https://api.openhive.network",
  "https://api.hive.blog",
  "https://api.deathwing.me",
  "https://hive-api.arcange.eu",
];

let configuredEndpoints: string[] = DEFAULT_ENDPOINTS;
let chain: Promise<WaxExtendedChain> | undefined;
let currentEndpointIndex = 0;

/**
 * Configure the API endpoints to use for Hive chain connections.
 * Call this before first use of getWax() if you want custom endpoints.
 */
export const configureEndpoints = (endpoints: string[]): void => {
  if (endpoints.length === 0)
    throw new WorkerBeeError("At least one endpoint must be provided");

  configuredEndpoints = [...endpoints];
  currentEndpointIndex = 0;
  chain = undefined;
};

const createChainWithFallback = async (): Promise<WaxExtendedChain> => {
  const endpoints = configuredEndpoints;
  let lastError: Error | null = null;

  for (let i = 0; i < endpoints.length; i++) {
    const endpointIndex = (currentEndpointIndex + i) % endpoints.length;
    const endpoint = endpoints[endpointIndex];

    try {
      const hiveChain = await createHiveChain({ apiEndpoint: endpoint });
      const extendedChain = hiveChain.extend(WaxExtendedData).extendRest(HafbeExtendedData);

      // Update current endpoint index for next time (prefer working endpoint)
      // eslint-disable-next-line require-atomic-updates
      currentEndpointIndex = endpointIndex;

      return extendedChain;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new WorkerBeeError("Failed to connect to any Hive API endpoint");
};

export const getWax = (): Promise<WaxExtendedChain> => {
  if (!chain)
    chain = createChainWithFallback();

  return chain;
};

/**
 * Reset chain to force reconnection (useful after timeout errors).
 * Automatically cycles to the next endpoint.
 */
export const resetWax = (): void => {
  chain = undefined;
  // Try next endpoint
  currentEndpointIndex = (currentEndpointIndex + 1) % configuredEndpoints.length;
};

/**
 * Helper to execute API calls with automatic retry on timeout.
 */
export const withRetry = async <T>(
  fn: (chain: WaxExtendedChain) => Promise<T>,
  maxRetries = 3
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++)
    try {
      const waxChain = await getWax();
      return await fn(waxChain);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isTimeout = lastError.message.toLowerCase().includes("timeout");

      if (isTimeout && attempt < maxRetries - 1) {
        resetWax();
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 300));
      } else if (!isTimeout)
        // Non-timeout error, don't retry
        throw lastError;

    }


  throw lastError || new WorkerBeeError("All retry attempts failed");
};
