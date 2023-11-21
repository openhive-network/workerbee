import { AutoBee } from "./bot";
import { IAutoBeeConstructor } from "./interfaces";

export { IAutoBee } from "./interfaces";
export { EBotStatus, IStartConfiguration } from "./bot";
export { AutoBeeError } from "./errors";

export default AutoBee as IAutoBeeConstructor;
