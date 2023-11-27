import EventEmitter from "events";
import beekeeperFactory, { IBeekeeperInstance, IBeekeeperOptions, IBeekeeperUnlockedWallet } from "@hive-staging/beekeeper";
import { ApiBlock, ApiTransaction, IHiveChainInterface, IWaxOptionsChain, createHiveChain, operation } from "@hive-staging/wax";
import type { Observer, Subscribable, Unsubscribable } from "rxjs";

import { AccountOperationVisitor } from "./account_observer";
import type { IWorkerBee, IBlockData, ITransactionData } from "./interfaces";

export interface IStartConfiguration {
  /**
   * Posting private key in WIF format
   *
   * @type {?string}
   */
  postingKey?: string;

  /**
   * Wax chain options
   *
   * @type {?Partial<IWaxOptionsChain>}
   * @default {}
   */
  chainOptions?: Partial<IWaxOptionsChain>;

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

export const DEFAULT_BLOCK_INTERVAL_TIMEOUT = 1500;

export class QueenBee {
  public constructor(
    private readonly worker: WorkerBee
  ) {}

  public block(idOrNumber: string | number): Subscribable<ApiBlock> {
    return {
      subscribe: (observer: Partial<Observer<ApiBlock>>): Unsubscribable => {
        const complete = (): void => {
          observer.complete?.();
          this.worker.off("block", listener);
        };

        const listener = ({ block, number }): void => {
          const confirm = (): void => {
            observer.next?.(block);
            complete();
          };

          if(typeof idOrNumber === "string") {
            if(idOrNumber === block.block_id)
              confirm();
          } else if(idOrNumber === number)
            confirm();
        };
        this.worker.on("block", listener);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }

  public transaction(txId: string): Subscribable<ApiTransaction> {
    return {
      subscribe: (observer: Partial<Observer<ApiTransaction>>): Unsubscribable => {
        const complete = (): void => {
          observer.complete?.();
          this.worker.off("transaction", listener);
        };

        const listener = ({ id, transaction }): void => {
          const confirm = (): void => {
            observer.next?.(transaction);
            complete();
          };

          if(txId === id)
            confirm();
        };
        this.worker.on("transaction", listener);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }

  public accountOperations(name: string): Subscribable<operation> {
    return {
      subscribe: (observer: Partial<Observer<operation>>): Unsubscribable => {
        const complete = (): void => {
          observer.complete?.();
          this.worker.off("transaction", listener);
        };

        const visitor = new AccountOperationVisitor(name);

        const listener = ({ transaction }: ITransactionData): void => {
          const confirm = (result: operation): void => {
            observer.next?.(result);
          };

          for(const op of transaction.operations) {
            const result = visitor.accept(op);

            if(typeof result === "object")
              confirm(result);
          }
        };
        this.worker.on("transaction", listener);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }
}

export class WorkerBee extends EventEmitter implements IWorkerBee {
  public running: boolean = false;

  public configuration: IStartConfiguration;

  private chain?: IHiveChainInterface;

  private beekeeper?: IBeekeeperInstance;

  private wallet?: IBeekeeperUnlockedWallet;

  private headBlockNumber: number = 0;

  public readonly observe: QueenBee = new QueenBee(this);

  public constructor(
    configuration: IStartConfiguration = {}
  ) {
    super();

    this.configuration = { ...DEFAULT_WORKERBEE_OPTIONS, ...configuration };

    // When halt is requested, indicate we are not going to do the task again
    super.on("halt", () => {
      this.running = false;
    });
  }

  private get isAuthorized(): boolean {
    return typeof this.configuration.postingKey === "string";
  }

  public async start(): Promise<void> {
    // Initialize chain and beekepeer if required
    if(typeof this.chain === "undefined" || typeof this.beekeeper === "undefined" || typeof this.wallet === "undefined") {
      this.chain = await createHiveChain(this.configuration.chainOptions);
      this.beekeeper = await beekeeperFactory(this.configuration.beekeeperOptions);

      const random = Math.random().toString(16)
        .slice(2);

      ({ wallet: this.wallet } = await this.beekeeper.createSession(random).createWallet(random));
      if(this.isAuthorized)
        await this.wallet.importKey(this.configuration.postingKey as string);

      ({ head_block_number: this.headBlockNumber } = await this.chain.api.database_api.get_dynamic_global_properties({}));
    }

    // Ensure the app is not running
    await this.stop();

    // Do the first task and run the app
    this.running = true;
    super.emit("start");

    this.doTask();
  }

  public async *[Symbol.asyncIterator](): AsyncIterator<IBlockData> {
    while(this.running)
      yield await new Promise(res => {
        super.once("block", res);
      });
  }

  public async doTask(): Promise<void> {
    try {
      // Get the head block, but wait at least DEFAULT_BLOCK_INTERVAL_TIMEOUT ms
      const [ { block } ] = await Promise.all([
        this.chain!.api.block_api.get_block({ block_num: this.headBlockNumber }),
        new Promise(res => { setTimeout(res, DEFAULT_BLOCK_INTERVAL_TIMEOUT); })
      ]);

      if(typeof block === "object") {
        super.emit("block", {
          number: this.headBlockNumber,
          block
        });

        for(let i = 0; i < block.transaction_ids.length; ++i)
          super.emit("transaction", {
            id: block.transaction_ids[i],
            transaction: block.transactions[i]
          });

        ++this.headBlockNumber;
      } // Else -> no new block
    } catch(error) {
      // Ensure we are emitting the Error instance
      super.emit("error", error instanceof Error ? error : new Error(`Unknown error occurred during automation: ${String(error)}`));

      // Wait before any next operation is performed to reduce spamming the API
      await new Promise(res => { setTimeout(res, DEFAULT_BLOCK_INTERVAL_TIMEOUT); });
    } finally {
      // Do the task if running
      if(this.running)
        this.doTask();
      else // Inform about the application stop otherwise
        super.emit("stop");
    }
  }

  public stop(): Promise<void> {
    return new Promise<void>(res => {
      if(!this.running)
        res();

      // Request application stop
      super.emit("halt");

      // Wait for the stop and resolve
      super.once("stop", res);
    });
  }

  public async delete(): Promise<void> {
    // This function actually allows you to actually reset the bot instance
    await this.stop();

    this.chain?.delete();
    this.wallet?.close();
    await this.beekeeper?.delete();

    this.chain = undefined;
    this.beekeeper = undefined;
    this.wallet = undefined;
  }
}
