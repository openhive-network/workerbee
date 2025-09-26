import { IWaxOptionsChain, IHiveChainInterface, TWaxExtended, ITransaction, ApiTransaction, dateFromString } from "@hiveio/wax";

import { IBlockData } from "./chain-observers/classifiers/block-classifier";
import { IBlockHeaderData } from "./chain-observers/classifiers/block-header-classifier";
import { JsonRpcFactory } from "./chain-observers/factories/jsonrpc/factory";
import { ObserverMediator } from "./chain-observers/observer-mediator";
import { BlockNotAvailableError, WorkerBeeError } from "./errors";
import type { IWorkerBee, IBroadcastOptions } from "./interfaces";
import { PastQueen } from "./past-queen";
import { QueenBee } from "./queen";
import { calculateRelativeTime } from "./utils/time";
import { getWax, WaxExtendTypes } from "./wax";

const HIVE_BLOCK_INTERVAL = 1000 * 3;

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
}

export const DEFAULT_WORKERBEE_OPTIONS = {
  chainOptions: {}
};

export const DEFAULT_BLOCK_INTERVAL_TIMEOUT_MS = 2000;

type TAsyncBlockIteratorResolveCallback = (value: IteratorResult<IBlockData & IBlockHeaderData, void>) => void;
type TAsyncBlockIteratorPromise = Promise<IteratorResult<IBlockData & IBlockHeaderData, void>>;

export class WorkerBee implements IWorkerBee<TWaxExtended<WaxExtendTypes> | undefined> {
  public readonly configuration: IStartConfiguration;

  public chain: TWaxExtended<WaxExtendTypes> | undefined;

  private intervalId: NodeJS.Timeout | undefined = undefined;

  public get running() {
    return this.intervalId !== undefined;
  }

  public get observe() {
    return new QueenBee(this);
  }

  public getVersion(): string {
    return process.env.npm_package_version as string;
  }

  public mediator = new ObserverMediator(new JsonRpcFactory(this));

  public constructor(
    configuration: IStartConfiguration = {}
  ) {
    this.configuration = { ...DEFAULT_WORKERBEE_OPTIONS, ...configuration };

    if(typeof configuration.explicitChain !== "undefined"
       && typeof configuration.chainOptions !== "undefined")
      throw new WorkerBeeError("explicitChain and chainOptions parameters are exclusive");

    if (typeof configuration.explicitChain !== "undefined")
      this.chain = configuration.explicitChain.extend<WaxExtendTypes>();
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

      const actualTime = calculateRelativeTime(fromBlockOrRelativeTime, dateFromString(dgp.time));

      const blocksBetween = Math.floor((new Date(`${dgp.time}Z`).getTime() - actualTime.getTime()) / (3 * 1000));

      if (blocksBetween <= 0)
        throw new WorkerBeeError(`Invalid time range: ${fromBlockOrRelativeTime} is in the future`);

      return new PastQueen(this, headBlockNumber - blocksBetween);
    });
  }

  public async broadcast(tx: ApiTransaction | ITransaction, options: IBroadcastOptions = {}): Promise<void> {
    if (!this.running)
      await this.start();

    const toBroadcast: ApiTransaction = "toApiJson" in tx ? tx.toApiJson() as ApiTransaction : tx as ApiTransaction;

    if(toBroadcast.signatures.length === 0)
      throw new WorkerBeeError("You are trying to broadcast transaction without signing!");

    const apiTx = this.chain!.createTransactionFromJson(toBroadcast);

    let timeoutId: NodeJS.Timeout | undefined = undefined;

    const blocksAnalyzed: number[] = [];

    return new Promise<void>((resolve, reject) => {
      const listener = this.observe.onTransactionIds(apiTx.id, apiTx.legacy_id).onBlock().subscribe({
        next(val) {
          const transaction = val.transactions[apiTx.id] || val.transactions[apiTx.legacy_id];
          if (transaction === undefined) {
            blocksAnalyzed.push(val.block.number);

            return;
          }

          clearTimeout(timeoutId);
          listener.unsubscribe();

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
          if (val instanceof BlockNotAvailableError)
            return; // Ignore not available block error if iteration executed before next block is available in live chain

          clearTimeout(timeoutId);
          listener.unsubscribe();
          reject(val);
        }
      });

      const expireIn = options.expireInMs ?? (HIVE_BLOCK_INTERVAL * 2);

      this.chain!.broadcast(apiTx).then(() => {
        timeoutId = setTimeout(async() => {
          listener.unsubscribe();
          const txTime = dateFromString(apiTx.transaction.expiration);
          let errorMessage = `Transaction #${apiTx.id} broadcasted successfully, but listener has expired.\n`;
          errorMessage += `Blocks analyzed: ${blocksAnalyzed.join(", ") || "(none)"}\nTransaction broadcast metadata:\n`;
          errorMessage += `  - Current timestamp:           ${new Date().toISOString()}\n`;
          errorMessage += `  - Transaction expiration time: ${txTime.toISOString()}\n`;
          try {
            const { time } = await this.chain!.api.database_api.get_dynamic_global_properties({});
            const headBlockTime = dateFromString(time);
            errorMessage += `  - Head block blockchain time:  ${headBlockTime.toISOString()}`;
          } catch {
            errorMessage += "  - (!) Unable to retrieve the blockchain time";
          }
          errorMessage += `\nTry adjusting the 'expireInMs' option (currently set to ${expireIn} ms) in the broadcast method to a higher value.`;
          reject(new WorkerBeeError(errorMessage));
        }, expireIn);
      }).catch(err => {
        listener.unsubscribe();
        reject(err);
      });
    });
  }

  public async start(): Promise<void> {
    // Initialize chain and beekepeer if required
    if(typeof this.chain === "undefined")
      this.chain = await getWax(this.configuration.chainOptions);

    this.stop();

    this.intervalId = setInterval(() => {
      void this.mediator.notify();
    }, DEFAULT_BLOCK_INTERVAL_TIMEOUT_MS);
  }

  public iterate(errorHandler?: boolean | ((error: WorkerBeeError) => void)): AsyncIterator<IBlockData & IBlockHeaderData> {
    /// This variable set to some function indicates that we have waiting promise (for next block)
    let promiseToResolveCb: TAsyncBlockIteratorResolveCallback|undefined;

    const createWaitingPromise = (): TAsyncBlockIteratorPromise => {
      return new Promise<IteratorResult<IBlockData & IBlockHeaderData, void>>(resolve => {
        /// Execution of this callbacl means that client loop requested next block (but we don't have it yet)
        promiseToResolveCb = resolve;
      });
    };

    const promisesQueue: TAsyncBlockIteratorPromise[] = [
      createWaitingPromise()
    ];

    // Create a single observer that will listen for block data
    const observer = this.observe.onBlock().provideBlockData().subscribe({
      next: data => {
        if(promiseToResolveCb !== undefined) {
          // Resolve the waiting promise in queue with the block data and pass it to the next iteration of user loop
          promiseToResolveCb({ value: data.block, done: false });
          /*
           * Clear held callbackFn reference and wait for client loop request for next iteration
           * (then promise resolution will happen, and will set promiseToResolveCb to actual function again)
           */
          promiseToResolveCb = undefined;
          promisesQueue.push(createWaitingPromise());
        } else
          /*
           * There is no more waiting promises (probably due to client loop blocking.
           * We can create immediately resolved promise and push it to the queue to be consumed by the next iteration
           */
          promisesQueue.push(Promise.resolve({ value: data.block, done: false }));

      },
      error: (err) => {
        if (errorHandler === true)
          promisesQueue.push(Promise.reject(err));
        else if (typeof errorHandler === "function")
          errorHandler(err);
      },
    });

    return {
      // With each call to the next() method, we return the current (first) promise
      next: () => {
        return promisesQueue.shift()!;
      },
      return: () => { // Cleanup on break
        observer.unsubscribe();
        return Promise.resolve({ done: true, value: undefined });
      }
    };
  }

  public [Symbol.asyncIterator](): AsyncIterator<IBlockData & IBlockHeaderData> {
    return this.iterate();
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

    this.chain = undefined;
  }
}
