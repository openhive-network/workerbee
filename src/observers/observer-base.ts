import type { Observer, Subscribable, Unsubscribable } from "rxjs";
import type { WorkerBee } from "../bot";
import { DataProvider, type TDataProviderOptions, TDataProviderForOptions } from "./register/register";

export type TSubscribableObserverOptions<T> = { current: T, previous?: T; };

export type TObserverFor<T extends Subscribable<any>> = Pick<T, "subscribe">;

/**
 * Generic class for creating observers that can be subscribed to.
 */
export abstract class ObserverBase<
  T,
  DataProviderOption extends TDataProviderOptions
> implements Subscribable<TSubscribableObserverOptions<T>> {
  private readonly dataProvider: DataProvider;

  public constructor(
    protected readonly worker: WorkerBee,
    protected readonly options: DataProviderOption & Record<string, any>
  ) {
    this.dataProvider = DataProvider.for(worker.register, options) as unknown as DataProvider;
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
    const lockedDataProvider = this.dataProvider.lock<DataProviderOption>();

    // Schedule a macrotask - this is necessary to prevent the event loop from being blocked before all data providers are locked on current event values
    setTimeout(async () => {
      try {
        const current = await this.retrieveData(lockedDataProvider);
        if(current === undefined)
          return;

        if (this.hasChanged(current, this.previous))
          this.observer?.next?.({ current, previous: this.previous });

        this.previous = current;
      } catch (error) {
        this.observer?.error?.(error);
      }
    }, 0);
  });
}
