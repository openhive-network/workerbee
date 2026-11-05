import type { IWorkerBeeConstructor } from "../packages/workerbee-core/src/interfaces";
import { WorkerBee } from "./bot";

export * from "../packages/workerbee-core/src/types/iterator";
export * from "../packages/workerbee-core/src/types/subscribable";

export * from "../packages/workerbee-core/src/chain-observers";

export * from "../packages/workerbee-core/src/interfaces";
export { WorkerBeeError } from "../packages/workerbee-core/src/errors";

export default WorkerBee as IWorkerBeeConstructor;
