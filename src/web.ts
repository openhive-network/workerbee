import { WorkerBee } from "./bot";
import { IWorkerBeeConstructor } from "./interfaces";

export * from "./interfaces";
export { IStartConfiguration } from "./bot";
export { WorkerBeeError } from "./errors";

export default WorkerBee as IWorkerBeeConstructor;
