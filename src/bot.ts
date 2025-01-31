import type { IBeekeeperOptions, IBeekeeperUnlockedWallet } from "@hiveio/beekeeper";
import { calculateExpiration, IWaxOptionsChain, IHiveChainInterface, TWaxExtended, ITransaction, ApiTransaction, transaction } from "@hiveio/wax";

import { IBlockData } from "./chain-observers/classifiers/block-classifier";
import { IBlockHeaderData } from "./chain-observers/classifiers/block-header-classifier";
import { ObserverMediator } from "./chain-observers/observer-mediator";
import { WorkerBeeError } from "./errors";
import type { IWorkerBee, IBroadcastOptions } from "./interfaces";
import { QueenBee } from "./queen";
import type { Subscribable } from "./types/subscribable";
import { getWax, WaxExtendTypes } from "./wax";

const ONE_MINUTE = 1000 * 60;

export interface IStartConfiguration {
  /**
   * Wax chain options
   *
   * @type {?Partial<IWaxOptionsChain>}
   * @default {}
   */
  chainOptions?: Partial<IWaxOptionsChain>;

  /**
   * Explicit instance of chain interface to be used by workerbee.
   * This option is exclusive to {@link chainOptions}
   */
  explicitChain?: IHiveChainInterface;

  /**
   * Beekeeper wallet options
   *
   * @type {?Partial<IBeekeeperOptions>}
   * @default {}
   */
  beekeeperOptions?: Partial<IBeekeeperOptions>;
}

export const DEFAULT_WORKERBEE_OPTIONS = {
  chainOptions: {}
};

export const DEFAULT_BLOCK_INTERVAL_TIMEOUT_MS = 2000;

export class WorkerBee implements IWorkerBee {
  public readonly configuration: IStartConfiguration;

  public chain?: TWaxExtended<WaxExtendTypes>;

  private wallet?: IBeekeeperUnlockedWallet;

  private intervalId: NodeJS.Timeout | undefined = undefined;

  public get running() {
    return this.intervalId !== undefined;
  }

  public get observe() {
    return new QueenBee(this);
  }

  public mediator = new ObserverMediator(this);

  public constructor(
    configuration: IStartConfiguration = {}
  ) {
    this.configuration = { ...DEFAULT_WORKERBEE_OPTIONS, ...configuration };

    if(typeof configuration.explicitChain !== "undefined"
       && typeof configuration.chainOptions !== "undefined")
      throw new WorkerBeeError("explicitChain and chainOptions parameters are exclusive");
  }

  public async broadcast(tx: ApiTransaction | ITransaction, options: IBroadcastOptions = {}): Promise<Subscribable<transaction>> {
    const toBroadcast: ApiTransaction = "toApiJson" in tx ? tx.toApiJson() as ApiTransaction : tx as ApiTransaction;

    if(toBroadcast.signatures.length === 0)
      throw new WorkerBeeError("You are trying to broadcast transaction without signing!");

    if(typeof options.throwAfter === "undefined") {
      const expiration = calculateExpiration(toBroadcast.expiration, new Date());

      if(typeof expiration === "undefined")
        throw new WorkerBeeError("Could not deduce the expiration time of the transaction");

      options.throwAfter = expiration.getTime() + ONE_MINUTE;
    }

    await this.chain!.broadcast(toBroadcast);

    // Here options.throwAfter should be defined (throws on invalid value)
    const expireDate: Date = calculateExpiration(options.throwAfter, new Date()) as Date;

    const apiTx = this.chain!.createTransactionFromJson(toBroadcast);

    return {
      subscribe: observer => {
        const listener = this.observe.onTransactionId(apiTx.id).subscribe({
          next(val) {
            observer.next?.(val.transactions[apiTx.id]!);
          },
          error(val) {
            observer.error?.(val);
          },
          complete() {
            observer.complete?.();
          }
        });
        const timeoutId = setTimeout(() => {
          listener.unsubscribe();
          observer.error?.(new WorkerBeeError(`Transaction ${apiTx.id} has expired`));
        }, expireDate.getTime() - Date.now());

        return {
          unsubscribe: () => {
            clearTimeout(timeoutId);
            listener.unsubscribe();
          }
        }
      }
    };
  }

  public async start(wallet?: IBeekeeperUnlockedWallet): Promise<void> {
    // Initialize chain and beekepeer if required
    if(typeof this.chain === "undefined")
      this.chain = await getWax(this.configuration.explicitChain, this.configuration.chainOptions);

    if(typeof this.wallet === "undefined")
      this.wallet = wallet;

    this.stop();

    setInterval(() => {
      this.mediator.notify();
    }, DEFAULT_BLOCK_INTERVAL_TIMEOUT_MS);
  }

  public [Symbol.asyncIterator](): AsyncIterator<IBlockData & IBlockHeaderData> {
    // TODO: Optimize this
    return {
      next: (): Promise<IteratorResult<IBlockData & IBlockHeaderData, void>> => {
        return new Promise(res => {
          const listener = this.observe.onBlock().provideBlockData().subscribe({
            next: block => {
              listener.unsubscribe();
              res({ value: block.block, done: false });
            }
          });
        });
      }
    };
  }

  public stop(): void {
    if(!this.running)
      return;

    clearTimeout(this.intervalId);
  }

  public delete(): void {
    this.stop();

    this.mediator.unregisterAllListeners();

    if(typeof this.configuration.explicitChain === "undefined")
      this.chain?.delete();

    this.wallet?.close();

    this.chain = undefined;
    this.wallet = undefined;
  }
}
