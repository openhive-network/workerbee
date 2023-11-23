import type { ApiBlock } from "@hive-staging/wax";
import type { IStartConfiguration } from "./bot";

export interface IBlockData {
  number: number;
  block: ApiBlock;
}

export interface IAutoBee {
  readonly running: boolean;
  readonly configuration: Readonly<IStartConfiguration>;

  /**
   * Starts the automation with given configuration
   */
  start(): Promise<void>;

  /**
   * Request automation stop
   */
  stop(): Promise<void>;

  /**
   * Deletes the current bot instance and underlying wax and beekepeer objects
   */
  delete(): Promise<void>;

  /**
   * Allows you to iterate over blocks indefinitely
   */
  [Symbol.asyncIterator](): AsyncIterator<IBlockData>;

  /**
   * Triggers on any bot start
   *
   * @param event event name
   * @param handler handler to be called before automation start
   */
  on(event: "start", handler: () => void): this;
  /**
   * Triggers on any bot stop
   *
   * @param event event name
   * @param handler handler to be called after complete stop of the automation
   */
  on(event: "stop", handler: () => void): this;
  /**
   * Triggers on any bot-related error
   *
   * @param event event name
   * @param handler handler to be called on error event
   */
  on(event: "error", handler: (error: Error) => void): this;
  /**
   * Triggers on new block detected
   *
   * @param event event name
   * @param handler handler to be called on new block event
   */
  on(event: "block", handler: (data: IBlockData) => void): this;
}

export interface IAutoBeeConstructor {
  /**
   * Constructs new AutoBee bot object
   *
   * @param configuration Configuration for the automation
   */
  new(configuration: Partial<IStartConfiguration>): IAutoBee;
}
