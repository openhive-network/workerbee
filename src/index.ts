import { AutoBee } from "./bot";
import { IAutoBeeConstructor } from "./interfaces";

export * from "./interfaces";
export { IStartConfiguration } from "./bot";
export { AutoBeeError } from "./errors";

export default AutoBee as IAutoBeeConstructor;
