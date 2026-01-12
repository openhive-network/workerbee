import type { ApiTransaction, IHiveChainInterface, ITransaction, transaction, TWaxExtended } from "@hiveio/wax";
import { IBlockData } from "./chain-observers/classifiers/block-classifier";
import { IBlockHeaderData } from "./chain-observers/classifiers/block-header-classifier";
import { WorkerBeeError } from "./errors";
import { TPastQueen } from "./past-queen";
import type { QueenBee } from "./queen";
import type { WaxExtendTypes } from "./wax";

export interface IBroadcastOptions {
  /**
   * If true, the bot will verify if the signatures in the transaction, applied on chain match the local ones
   *
   * @type {boolean}
   * @default false
   */
  verifySignatures?: boolean;

  /**
   * Time in milliseconds after which the transaction will be considered expired
   *
   * @type {number}
   * @default 6000
   */
  expireInMs?: number;
}

export interface IBroadcastData {
  transaction: transaction;
  block: IBlockHeaderData;
}

export interface IWorkerBee {
  /**
   * Indicates if the bot is running
   * @type {boolean}
   * @readonly
   */
  readonly running: boolean;

  /**
   * Exposed hive chain interface we are using.
   */
  readonly chain: TWaxExtended<WaxExtendTypes>;

  /**
   * Starts the automation with given configuration
   */
  start(): void;

  /**
   * Request automation stop
   */
  stop(): void;

  /**
   * Deletes the current bot instance and underlying wax and beekepeer objects.
   * wax chain object is deleted only when its instance was managed by workerbee itself.
   */
  delete(): void;

  /**
   * Allows you to iterate over blocks in the past from a given range
   *
   * Note: This should be called only once per instance.
   * If you want to iterate over multiple ranges, you should create a new instance of WorkerBee.
   *
   * Data collected by this method will be preserved for later usage by the live observer.
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @example
   * ```ts
   * await new Promise((resolve, reject) => {
   *   workerbee.providePastOperations(10_000, 10_500).onBlock().subscribe({
   *     next: (data) => {
   *       console.log(data);
   *     },
   *     error: reject,
   *     complete: resolve
   *   });
   * });
   * ```
   *
   * @throws if called before {@link start}
   */
  providePastOperations(fromBlock: number, toBlock: number): TPastQueen;

  /**
   * Allows you to iterate over blocks in the past from a given range
   *
   * Note: This should be called only once per instance.
   * If you want to iterate over multiple ranges, you should create a new instance of WorkerBee.
   *
   * Data collected by this method will be preserved for later usage by the live observer.
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @example
   * ```ts
   * workerbee.providePastOperations('-7d').then((provider) => {
   *   provider.onBlock().subscribe({
   *     next: (data) => {
   *       console.log(data);
   *     },
   *     error: console.error,
   *     complete: () => {
   *      console.log('Completed');
   *     }
   *   });
   * });
   * ```
   *
   * @throws if called before {@link start}
   */
  providePastOperations(relativeTime: string): Promise<TPastQueen>;

  /**
   * Allows you to iterate over blocks in live mode
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @example
   * ```ts
   * workerbee.observe.onBlock().subscribe({
   *   next: (data) => {
   *     console.log(data);
   *   },
   *   error: console.error
   * });
   * ```
   */
  get observe(): QueenBee;

  /**
   * @returns {string} The version of the library
   */
  getVersion(): string;

  /**
   * Broadcast given transaction to the remote and returns a promise resolved when
   * transaction has been successfully applied on chain.
   * You can also optionally provide {@link IBroadcastOptions verifySignatures} option
   * if you want to ensure that the signatures in the transaction, applied on chain match the local ones.
   *
   * Requires signed transaction
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @param tx Protobuf transactoin to broadcast
   * @param options Options for broadcasting
   */
  broadcast(tx: ApiTransaction | ITransaction, options?: IBroadcastOptions): Promise<void>;

  /**
   * Allows you to iterate over blocks indefinitely
   *
   * Ignores errors
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @example
   * ```ts
   * for await (const block of workerbee) {
   *   console.log(block);
   * }
   * ```
   */
  [Symbol.asyncIterator](): AsyncIterator<IBlockData & IBlockHeaderData>;

  /**
   * Allows you to iterate over blocks indefinitely - alias to async iterator
   *
   * Ignores errors
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @example
   * ```ts
   * for await (const block of workerbee.iterate()) {
   *   console.log(block);
   * }
   * ```
   */
  iterate(): AsyncIterator<IBlockData & IBlockHeaderData>;

  /**
   * Allows you to iterate over blocks indefinitely - alias to async iterator
   *
   * Allows to handle errors via try/catch clause around the async iterator
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @param throwOnError If true, the error will be thrown
   *
   * @example
   * ```ts
   * try {
   *   for await (const block of workerbee.iterate(true)) {
   *     console.log(block);
   *   }
   * } catch (error) {
   *   console.error("Error while iterating:", error);
   * }
   * ```
   */
  iterate(throwOnError: boolean): AsyncIterator<IBlockData & IBlockHeaderData>;

  /**
   * Allows you to iterate over blocks indefinitely - alias to async iterator
   *
   * Allows to handle errors via callback
   *
   * Note: Call {@link start} explicitly by yourself if the bot is not running yet, either before this or directly after.
   *
   * @param errorHandler Callback function to handle errors
   *
   * @example
   * ```ts
   * for await (const block of workerbee.iterate(console.error))
   *   console.log(block);
   * ```
   */
  iterate(errorHandler: (error: WorkerBeeError) => void): AsyncIterator<IBlockData & IBlockHeaderData>;
}

export interface IWorkerBeeConstructor {
  /**
   * Constructs new WorkerBee bot object
   *
   * @param chain Chain interface to the hive compatible chain
   *
   * @note If you do not register an "error" event listener, the error will be dropped silently
   */
  new(chain: IHiveChainInterface): IWorkerBee;
}
