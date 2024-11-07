import type { ApiBlock } from "@hiveio/wax";
import type { Observer, Subscribable, Unsubscribable } from "rxjs";
import type { WorkerBee } from "../bot";
import { DataProvider, type TDataProviderOptions, TDataProviderForOptions } from "./register";

export type TSubscribableObserverOptions<T> = { current: T, previous?: T; block: ApiBlock; blockNumber: number };

export type TObserverFor<T extends Subscribable<any>> = Pick<T, "subscribe">;

/**
 * Generic class for creating observers that can be subscribed to.
 */
export abstract class ObserverBase<
  T,
  DataProviderOption extends TDataProviderOptions
> implements Subscribable<TSubscribableObserverOptions<T>> {
  private readonly dataProvider: TDataProviderForOptions<DataProviderOption>;

  public constructor(
    protected readonly worker: WorkerBee,
    protected readonly options: DataProviderOption & Record<string, any>
  ) {
    this.dataProvider = DataProvider.for(worker.register, options);
  }

  protected observer?: Partial<Observer<TSubscribableObserverOptions<T>>>;

  public subscribe(observer: Partial<Observer<TSubscribableObserverOptions<T>>>): Unsubscribable {
    this.observer = observer;

    this.worker.register.registerListener(this.update, this.options);

    return {
      unsubscribe: () => {
        this.worker.register.unregisterListener(this.update, this.options);

        this.observer?.complete?.();
      }
    }
  }

  private previous?: T;

  protected abstract hasChanged(current?: T, previous?: T): boolean;

  protected abstract retrieveData(dataProvider: TDataProviderForOptions<DataProviderOption>): Promise<T | undefined> | T | undefined;

  private update = ((): void => {
    (async () => {
      const current = await this.retrieveData(this.dataProvider);
      if(current === undefined)
        return;

      if (this.hasChanged(current, this.previous))
        this.observer?.next?.({ current, previous: this.previous, block: this.dataProvider.block, blockNumber: this.dataProvider.blockNumber });

      this.previous = current;
    })().catch(error => { this.observer?.error?.(error); });
  });
}
