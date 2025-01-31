import type { IBeekeeperUnlockedWallet } from "@hiveio/beekeeper";
import type { ApiTransaction, IHiveChainInterface, ITransaction, transaction} from "@hiveio/wax";
import type { IStartConfiguration } from "./bot";
import { IBlockData } from "./chain-observers/classifiers/block-classifier";
import { IBlockHeaderData } from "./chain-observers/classifiers/block-header-classifier";
import type { QueenBee } from "./queen";
import type { Subscribable } from "./types/subscribable";

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

export interface IBroadcastData {
  transaction: transaction;
  block: IBlockHeaderData;
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
  stop(): void;

  /**
   * Deletes the current bot instance and underlying wax and beekepeer objects.
   * wax chain object is deleted only when its instance was managed by workerbee itself.
   */
  delete(): void;

  get observe(): QueenBee;

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
  broadcast(tx: ApiTransaction | ITransaction, options?: IBroadcastOptions): Promise<Subscribable<IBroadcastData>>;

  /**
   * Allows you to iterate over blocks indefinitely
   */
  [Symbol.asyncIterator](): AsyncIterator<IBlockData & IBlockHeaderData>;
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
