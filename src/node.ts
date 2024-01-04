import { WorkerBee } from "./bot.node";
import { IWorkerBeeConstructor } from "./interfaces";

export * from "./interfaces";
export { IStartConfiguration } from "./bot.node";
export { WorkerBeeError } from "./errors";

export default WorkerBee as IWorkerBeeConstructor;
