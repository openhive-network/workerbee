import type { IBeekeeperUnlockedWallet } from "@hiveio/beekeeper";
import type {
  ApiAccount, ApiBlock, ApiTransaction, FindRcAccountsResponse,
  GetDynamicGlobalPropertiesResponse, IHiveChainInterface,
  ITransaction, operation } from "@hiveio/wax";
import type { Subscribable } from "rxjs";
import type { IStartConfiguration } from "./bot";
import type { WorkerBeeError } from "./errors";

export interface IBlockData {
  number: number;
  block: ApiBlock;
}

export interface ITransactionData {
  id: string;
  transaction: ApiTransaction;
  block: IBlockData;
}

export interface IOperationData {
  op: operation;
  transaction: ITransactionData;
}

export interface IDgpoData {
  dgpo: GetDynamicGlobalPropertiesResponse;
  block: IBlockData;
}

export interface IAccountData {
  account: ApiAccount;
  block: IBlockData;
}

export interface IRcAccountData {
  rcAccount: FindRcAccountsResponse;
  block: IBlockData;
}

export interface IQueenBee {
  /**
   * Observes block with given id and notifies on its detection
   *
   * @param blockId block id to observe
   * @returns subscribable object that will call `next` only once and completes
   */
  block(blockId: string): Subscribable<IBlockData>;
  /**
   * Observes block with given number and notifies on its detection
   *
   * @param blockNumber block number to observe
   * @returns subscribable object that will call `next` only once and completes
   */
  block(blockNumber: number): Subscribable<IBlockData>;

  /**
   * Observes transaction with given id and notifies on its detection
   *
   * @param transactionId transaction id to observe
   * @returns subscribable object that will call `next` only once and completes
   */
  transaction(transactionId: string): Subscribable<ITransactionData>;

  /**
   * Observes given account and notifies when new operation in blockchain related to the given account is detected (no virtual operations for now)
   *
   * @param name account name to observe
   * @returns subscribable object that will call `next` on every operation related to the given account
   */
  accountOperations(name: string): Subscribable<IOperationData>;

  /**
   * Observes given account and notifies when its manabar is 98 percent loaded
   * Note: This function will be called on every new block detected if manabar is full on every new block
   *
   * @param name account name to observe
   * @returns subscribable object that will call `next` each time time its manabar is 98 percent loaded
   */
  accountFullManabar(name: string): Subscribable<ApiAccount>;
}

export interface IBroadcastOptions {
  /**
   * Can be either absolute time that will be passed to the Date constructor
   * or relative time, like: "+10s", "+2m", "+1h"
   *
   * @type {string | number | Date}
   * @default undefined
   */
  throwAfter?: string | number | Date;
}

export interface IWorkerBeeEvents {
  "stop": () => void | Promise<void>;
  "start": () => void | Promise<void>;
  "block": (blockData: IBlockData) => void | Promise<void>;
  "transaction": (transactionData: ITransactionData) => void | Promise<void>;
  "error": (error: WorkerBeeError) => void | Promise<void>;
}

export interface IWorkerBee {
  readonly running: boolean;
  readonly configuration: Readonly<IStartConfiguration>;

  /**
   * Exposed hive chain interface we are using.
   * May be undefined if you have not already started our bot.
   *
   * Remember that chain property will be initialized during {@link start} call and uninitialized during {@link delete}
   */
  readonly chain?: Readonly<IHiveChainInterface>;

  /**
   * Starts the automation with given configuration
   *
   * @param {?IBeekeeperUnlockedWallet} wallet optional unlocked beekeper wallet for bot operations
   */
  start(wallet?: IBeekeeperUnlockedWallet): Promise<void>;

  /**
   * Request automation stop
   */
  stop(): Promise<void>;

  /**
   * Deletes the current bot instance and underlying wax and beekepeer objects.
   * wax chain object is deleted only when its instance was managed by workerbee itself.
   */
  delete(): Promise<void>;

  readonly observe: IQueenBee;

  /**
   * Broadcast given transaction to the remote and returns a subscribable object
   * that calls error after {@link IBroadcastOptions throwAfter} time (if given)
   * If {@link IBroadcastOptions throwAfter} has not been specified, it is automatically
   * set to the transaction expiration time plus one minute
   *
   * Requires signed transaction
   *
   * @param tx Protobuf transactoin to broadcast
   * @param options Options for broadcasting
   */
  broadcast(tx: ApiTransaction | ITransaction, options?: IBroadcastOptions): Promise<Subscribable<ITransactionData>>;

  /**
   * Allows you to iterate over blocks indefinitely
   */
  [Symbol.asyncIterator](): AsyncIterator<IBlockData>;

  on<U extends keyof IWorkerBeeEvents>(
    event: U, listener: IWorkerBeeEvents[U]
  ): this;

  once<U extends keyof IWorkerBeeEvents>(
    event: U, listener: IWorkerBeeEvents[U]
  ): this;

  off<U extends keyof IWorkerBeeEvents>(
    event: U, listener: IWorkerBeeEvents[U]
  ): this;
}

export interface IWorkerBeeConstructor {
  /**
   * Constructs new WorkerBee bot object
   *
   * @param configuration Configuration for the automation
   *
   * @note If you do not register an "error" event listener, the error will be dropped silently
   */
  new(configuration?: Partial<IStartConfiguration>): IWorkerBee;
}
