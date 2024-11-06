import type { Observer, Subscribable, Unsubscribable } from "rxjs";
import type { WorkerBee } from "../bot";
import { WorkerBeeError } from "../errors";
import type { IBlockData, ITransactionData } from "../interfaces";

export type TSubscribableObserverOptions<T, OtherMetadata extends object = {}> = OtherMetadata & { current: T, previous?: T };

/**
 * Generic class for creating observers that can be subscribed to.
 */
export abstract class ObserverBase<
  T,
  OtherOptions extends object = {},
  OtherMetadata extends object = {}
> implements Subscribable<TSubscribableObserverOptions<T, OtherMetadata>> {
  public constructor(
    protected readonly bot: WorkerBee,
    protected readonly options: OtherOptions
  ) {}

  protected observer?: Observer<TSubscribableObserverOptions<T, OtherMetadata>>;

  public subscribe(observer: Observer<TSubscribableObserverOptions<T, OtherMetadata>>): Unsubscribable {
    if (this.onBlock !== undefined)
      this.bot.on("block", this.onBlock);
    else if (this.onTransaction !== undefined)
      this.bot.on("transaction", this.onTransaction);
    else
      throw new WorkerBeeError("No standard event handlers registered - cannot register subscriber");

    this.observer = observer;

    return {
      unsubscribe: () => {
        this.observer?.complete();

        this.observer = undefined;

        if (this.onBlock !== undefined)
          this.bot.off("block", this.onBlock);
        else if (this.onTransaction !== undefined)
          this.bot.off("transaction", this.onTransaction);
      }
    }
  }

  protected previous?: T;

  protected abstract hasChanged(current: T, previous?: T): boolean;

  protected abstract retrieveData(metadata: OtherMetadata): T | Promise<T>;

  protected update(data: OtherMetadata): void {
    (async () => {
      const current = await this.retrieveData(data);
      if (this.hasChanged(current, this.previous))
        this.observer?.next({ current, previous: this.previous, ...data });

      this.previous = current;
    })().catch(error => { this.observer?.error(error); });
  }

  protected onBlock?: (blockData: IBlockData) => void;
  protected onTransaction?: (transactionData: ITransactionData) => void;
}

export interface IBlockObserverMetadata {
  block: IBlockData;
}

/**
 * Classes that extend this class will be notified (See {@link retrieveData}) to retrieve data on each new block detected
 */
export abstract class BlockObserver<T, OtherOptions extends object = {}> extends ObserverBase<T, OtherOptions, { block: IBlockData }> {
  protected onBlock = ((block: IBlockData) => {
    this.update({ block });
  });
}

export interface ITransactionObserverMetadata {
  transaction: ITransactionData;
}

/**
 * Classes that extend this class will be notified (See {@link retrieveData}) to retrieve data on each new transaction detected
 */
export abstract class TransactionObserver<T, OtherOptions extends object = {}> extends ObserverBase<T, OtherOptions, ITransactionObserverMetadata> {
  protected onTransaction = ((transaction: ITransactionData) => {
    this.update({ transaction });
  });
}
