import type EventEmitter from "events";
import type { ApiBlock, ApiTransaction } from "@hive-staging/wax";
import type { Subscribable } from "rxjs";
import type { IStartConfiguration } from "./bot";

export interface IBlockData {
  number: number;
  block: ApiBlock;
}

export interface ITransactionData {
  id: string;
  transaction: ApiTransaction;
}

export interface IQueenBee {
  block(blockId: string): Subscribable<ApiBlock>;
  block(blockNumber: number): Subscribable<ApiBlock>;

  transaction(transactionId: string): Subscribable<ApiTransaction>;

  // TODO: Account
}

export interface IAutoBee extends EventEmitter {
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

  readonly observe: IQueenBee;

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
  /**
   * Triggers on new transaction detected
   *
   * @param event event name
   * @param handler handler to be called on new block event
   */
  on(event: "transaction", handler: (data: ITransactionData) => void): this;
}

export interface IAutoBeeConstructor {
  /**
   * Constructs new AutoBee bot object
   *
   * @param configuration Configuration for the automation
   */
  new(configuration: Partial<IStartConfiguration>): IAutoBee;
}
