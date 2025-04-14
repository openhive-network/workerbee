import type { IBeekeeperOptions, IBeekeeperUnlockedWallet } from "@hiveio/beekeeper";
import { calculateExpiration, IWaxOptionsChain, IHiveChainInterface, TWaxExtended, ITransaction, ApiTransaction } from "@hiveio/wax";

import { IBlockData } from "./chain-observers/classifiers/block-classifier";
import { IBlockHeaderData } from "./chain-observers/classifiers/block-header-classifier";
import { JsonRpcFactory } from "./chain-observers/factories/jsonrpc/factory";
import { ObserverMediator } from "./chain-observers/observer-mediator";
import { WorkerBeeError } from "./errors";
import type { IWorkerBee, IBroadcastOptions } from "./interfaces";
import { PastQueen } from "./past-queen";
import { QueenBee } from "./queen";
import { calculateRelativeTime } from "./utils/time";
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

  public mediator = new ObserverMediator(new JsonRpcFactory(this));

  public constructor(
    configuration: IStartConfiguration = {}
  ) {
    this.configuration = { ...DEFAULT_WORKERBEE_OPTIONS, ...configuration };

    if(typeof configuration.explicitChain !== "undefined"
       && typeof configuration.chainOptions !== "undefined")
      throw new WorkerBeeError("explicitChain and chainOptions parameters are exclusive");
  }

  public providePastOperations(fromBlock: number, toBlock: number): PastQueen;
  public providePastOperations(relativeTime: string): Promise<PastQueen>;
  public providePastOperations(fromBlockOrRelativeTime: number | string, toBlock?: number): PastQueen | Promise<PastQueen> {
    if(typeof this.chain === "undefined")
      throw new WorkerBeeError("Chain is not initialized. Either provide explicit chain or run start()");

    if (typeof fromBlockOrRelativeTime === "number" && typeof toBlock === "number")
      return new PastQueen(this, fromBlockOrRelativeTime, toBlock);

    return this.chain!.api.database_api.get_dynamic_global_properties({}).then(dgp => {
      const headBlockNumber = dgp.head_block_number;

      const actualTime = calculateRelativeTime(fromBlockOrRelativeTime);

      const blocksBetween = Math.floor((new Date(`${dgp.time}Z`).getTime() - actualTime.getTime()) / (3 * 1000));

      if (blocksBetween <= 0)
        throw new WorkerBeeError(`Invalid time range: ${fromBlockOrRelativeTime} is in the future`);

      return new PastQueen(this, headBlockNumber - blocksBetween);
    });
  }

  public broadcast(tx: ApiTransaction | ITransaction, options: IBroadcastOptions = {}): Promise<void> {
    const toBroadcast: ApiTransaction = "toApiJson" in tx ? tx.toApiJson() as ApiTransaction : tx as ApiTransaction;

    if(toBroadcast.signatures.length === 0)
      throw new WorkerBeeError("You are trying to broadcast transaction without signing!");

    if(typeof options.throwAfter === "undefined") {
      const expiration = calculateExpiration(toBroadcast.expiration, new Date());

      if(typeof expiration === "undefined")
        throw new WorkerBeeError("Could not deduce the expiration time of the transaction");

      options.throwAfter = expiration.getTime() + ONE_MINUTE;
    }

    const apiTx = this.chain!.createTransactionFromJson(toBroadcast);

    // Here options.throwAfter should be defined (throws on invalid value)
    const throwAfter = options.throwAfter!;

    // Pre-check if the value is valid to prevent throw after successful broadcast
    if (calculateExpiration(throwAfter, new Date()).getTime() < Date.now())
      throw new WorkerBeeError(`Transaction #${apiTx.id} has expired`);

    let timeoutId: NodeJS.Timeout | undefined = undefined;

    return new Promise<void>((resolve, reject) => {
      const listener = this.observe.onTransactionId(apiTx.id).or.onTransactionId(apiTx.legacy_id).provideBlockHeaderData().subscribe({
        next(val) {
          clearTimeout(timeoutId);
          listener.unsubscribe();

          const transaction = val.transactions[apiTx.id] || val.transactions[apiTx.legacy_id];
          if (transaction === undefined) {
            reject(new WorkerBeeError(`Transaction broadcast error: Observer filter matched on block ${val.block.number
            }, but transaction #${apiTx.id} not found in the provided data. Please report this issue`));
            return;
          }

          if (options.verifySignatures) {
            if(transaction.signatures.length !== apiTx.transaction.signatures.length) {
              reject(new WorkerBeeError("Transaction broadcast error: Signatures length mismatch in broadcast result"));
              return;
            }

            for(let i = 0; i < transaction.signatures.length; ++i)
              if(transaction.signatures[i] !== apiTx.transaction.signatures[i]) {
                reject(new WorkerBeeError(`Transaction broadcast error: Signatures mismatch in broadcast result at index: ${i}`));
                return;
              }
          }

          resolve();
        },
        error(val) {
          clearTimeout(timeoutId);
          listener.unsubscribe();
          reject(val);
        }
      });

      this.chain!.broadcast(apiTx).then(() => {
        // Recalculate expiration time to match the actual transaction broadcast time user requested
        const expireDate: Date = calculateExpiration(throwAfter, new Date()) as Date;

        timeoutId = setTimeout(() => {
          listener.unsubscribe();
          reject(new WorkerBeeError(`Transaction broadcast error: Transaction #${apiTx.id} has expired`));
        }, expireDate.getTime() - Date.now());
      }).catch(err => {
        listener.unsubscribe();
        reject(err);
      });
    });
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

  public iterate(): AsyncIterator<IBlockData & IBlockHeaderData> {
    return this[Symbol.asyncIterator]();
  }

  public [Symbol.asyncIterator](): AsyncIterator<IBlockData & IBlockHeaderData> {
    let currentResolver = (_: IteratorResult<IBlockData & IBlockHeaderData, void>) => {};
    let currentPromise = new Promise<IteratorResult<IBlockData & IBlockHeaderData, void>>(resolve => { currentResolver = resolve });

    const observer = this.observe.onBlock().provideBlockData().subscribe({
      next: data => {
        currentResolver({ value: data.block, done: false });
        currentPromise = new Promise(resolve => { currentResolver = resolve });
      }
    });

    return {
      next: () => currentPromise,
      return: () => { // Cleanup on break
        observer.unsubscribe();
        return Promise.resolve({ done: true, value: undefined });
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
