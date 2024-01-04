import { WorkerBee } from "./bot.web";
import { IWorkerBeeConstructor } from "./interfaces";

export * from "./interfaces";
export { IStartConfiguration } from "./bot.web";
export { WorkerBeeError } from "./errors";

export default WorkerBee as IWorkerBeeConstructor;
