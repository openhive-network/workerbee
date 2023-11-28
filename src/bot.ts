import EventEmitter from "events";
import beekeeperFactory, { IBeekeeperInstance, IBeekeeperOptions, IBeekeeperUnlockedWallet } from "@hive-staging/beekeeper";
import { BroadcastTransactionRequest, IWaxOptionsChain, operation, transaction, TWaxExtended } from "@hive-staging/wax";
import type { Observer, Subscribable, Unsubscribable } from "rxjs";

import { AccountOperationVisitor } from "./account_observer";
import { WorkerBeeError } from "./errors";
import type { IWorkerBee, IBlockData, ITransactionData, IOperationData, IBroadcastOptions } from "./interfaces";
import { getWax, WaxExtendTypes } from "./wax/extend";

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

  public block(idOrNumber: string | number): Subscribable<IBlockData> {
    return {
      subscribe: (observer: Partial<Observer<IBlockData>>): Unsubscribable => {
        const complete = (): void => {
          observer.complete?.();
          this.worker.off("block", listener);
        };

        const listener = (blockData: IBlockData): void => {
          const confirm = (): void => {
            observer.next?.(blockData);
            complete();
          };

          if(typeof idOrNumber === "string") {
            if(idOrNumber === blockData.block.block_id)
              confirm();
          } else if(idOrNumber === blockData.number)
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

  public transaction(txId: string, expireIn?: number): Subscribable<ITransactionData> {
    return {
      subscribe: (observer: Partial<Observer<ITransactionData>>): Unsubscribable => {
        const complete = (): void => {
          observer.complete?.();
          this.worker.off("transaction", listener);
        };

        const listener = (transactionData: ITransactionData): void => {
          const confirm = (): void => {
            observer.next?.(transactionData);
            complete();
          };

          if(txId === transactionData.id)
            confirm();
        };
        this.worker.on("transaction", listener);

        if(typeof expireIn === "number")
          setTimeout(() => {
            observer.error?.(new WorkerBeeError("Transaction expired"));

            complete();
          }, expireIn);

        return {
          unsubscribe: (): void => {
            complete();
          }
        };
      }
    };
  }

  public accountOperations(name: string): Subscribable<IOperationData> {
    return {
      subscribe: (observer: Partial<Observer<IOperationData>>): Unsubscribable => {
        const complete = (): void => {
          observer.complete?.();
          this.worker.off("transaction", listener);
        };

        const visitor = new AccountOperationVisitor(name);

        const listener = (transactionData: ITransactionData): void => {
          const confirm = (result: operation): void => {
            observer.next?.({ op: result, transaction: transactionData });
          };

          const proto = this.worker.chain!.TransactionBuilder.fromApi(transactionData.transaction).build();

          for(const op of proto.operations) {
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

  public chain?: TWaxExtended<typeof WaxExtendTypes>;

  private publicKey!: string;

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

  private getExpirationTime(expirationTime?: Date | string | number): number | void {
    if(typeof expirationTime === "undefined")
      return;

    let expiration: Date;
    if(typeof expirationTime === "string" && expirationTime[0] === "+") {
      let mul = 1000;

      switch(expirationTime[expirationTime.length - 1]) {
      case"h":
        mul *= 60;
      /* eslint-disable no-fallthrough */
      case"m":
        mul *= 60;
      /* eslint-disable no-fallthrough */
      default:
      }

      const num = Number.parseInt((/\d+/).exec(expirationTime)?.[0] as string);
      if(Number.isNaN(num))
        throw new WorkerBeeError("Invalid expiration time offset");

      expiration = new Date(Date.now() + (num * mul));
    } else
      expiration = new Date(expirationTime);


    const final = Date.now() - expiration.getTime();
    if(final > 0)
      return final;
  }

  public async broadcast(tx: transaction, options: IBroadcastOptions = {}): Promise<Subscribable<ITransactionData>> {
    if(tx.signatures.length === 0) {
      if(!this.isAuthorized)
        throw new WorkerBeeError("You are trying to broadcast transaction without signing!");

      tx = new this.chain!.TransactionBuilder(tx).build(this.wallet!, this.publicKey);
    }

    const apiTx = new this.chain!.TransactionBuilder(tx);

    await this.chain!.api.network_broadcast_api.broadcast_transaction(new BroadcastTransactionRequest(apiTx));

    const expireIn: number | undefined = this.getExpirationTime(options.throwAfter) as number | undefined;

    return this.observe.transaction(apiTx.id, expireIn);
  }

  public async start(): Promise<void> {
    // Initialize chain and beekepeer if required
    if(typeof this.chain === "undefined")
      this.chain = await getWax(this.configuration.chainOptions);

    if(typeof this.beekeeper === "undefined" || typeof this.wallet === "undefined") {
      this.beekeeper = await beekeeperFactory(this.configuration.beekeeperOptions);

      const random = Math.random().toString(16)
        .slice(2);

      ({ wallet: this.wallet } = await this.beekeeper.createSession(random).createWallet(random));
      if(this.isAuthorized)
        this.publicKey = await this.wallet.importKey(this.configuration.postingKey as string);

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
        const blockData = {
          number: this.headBlockNumber,
          block
        };

        super.emit("block", blockData);

        for(let i = 0; i < block.transaction_ids.length; ++i)
          super.emit("transaction", {
            id: block.transaction_ids[i],
            transaction: block.transactions[i],
            block: blockData
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
