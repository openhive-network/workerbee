/**
 * WorkerBee for the n8n nodes: the core on a JSON-RPC chain without WebAssembly. The nodes give the runtime.
 */
export * from "../../packages/workerbee-core/src/index";

export { createJsonRpcChain, WorkerBeeUnavailableError } from "./chain";
export type { IJsonRpcChain } from "./chain";
export { transactionFromApi } from "./api-to-proto";
export { calculateCurrentManabarValue } from "./manabar";

/** Defined by scripts/bundle-workerbee.mjs */
declare const N8N_PACKAGE_VERSION: string;

/** The version of the n8n package WorkerBee is built into */
export const version: string = N8N_PACKAGE_VERSION;
