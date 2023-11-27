import type EventEmitter from "events";
import type { ApiBlock, ApiTransaction, operation } from "@hive-staging/wax";
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
  /**
   * Observes block with given id and notifies on its detection
   *
   * @param blockId block id to observe
   * @returns subscribable object that will call `next` only once and completes
   */
  block(blockId: string): Subscribable<ApiBlock>;
  /**
   * Observes block with given number and notifies on its detection
   *
   * @param blockNumber block number to observe
   * @returns subscribable object that will call `next` only once and completes
   */
  block(blockNumber: number): Subscribable<ApiBlock>;

  /**
   * Observes transaction with given id and notifies on its detection
   *
   * @param transactionId transaction id to observe
   * @returns subscribable object that will call `next` only once and completes
   */
  transaction(transactionId: string): Subscribable<ApiTransaction>;

  /**
   * Observes given account and notifies when new operation in blockchain related to the given account is detected
   *
   * @param name account name to observe
   * @returns subscribable object that will call `next` on every operation related to the given account
   */
  accountOperations(name: string): Subscribable<operation>;
}

export interface IWorkerBee extends EventEmitter {
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

export interface IWorkerBeeConstructor {
  /**
   * Constructs new WorkerBee bot object
   *
   * @param configuration Configuration for the automation
   */
  new(configuration?: Partial<IStartConfiguration>): IWorkerBee;
}
