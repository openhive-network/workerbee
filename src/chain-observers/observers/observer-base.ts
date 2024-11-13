import type { Observer, Subscribable, Unsubscribable } from "rxjs";
import { CollectorsOptions, ProvidersData } from "../providers-mediator";
import { ObserversRegistry } from "../registry";

export type TSubscribableObserverOptions<T> = { current: T, previous?: T; };

export type TObserverFor<T extends Subscribable<any>> = Pick<T, "subscribe">;

/**
 * Generic class for creating observers that can be subscribed to.
 */
export abstract class ObserverBase<T> implements Subscribable<TSubscribableObserverOptions<T>> {
  protected registry = ObserversRegistry.getInstance();

  public constructor(
    protected readonly options: Partial<CollectorsOptions>
  ) {}

  protected observer?: Partial<Observer<TSubscribableObserverOptions<T>>>;

  public subscribe(observer: Partial<Observer<TSubscribableObserverOptions<T>>>): Unsubscribable {
    this.observer = observer;

    this.registry.registerListener(this.update, this.options as CollectorsOptions);

    return {
      unsubscribe: () => {
        this.registry.unregisterListener(this.update);

        this.observer?.complete?.();
      }
    }
  }

  private previous?: T;

  protected hasChanged?(current?: T, previous?: T): boolean;

  protected abstract retrieveData(providers: ProvidersData): Promise<T | undefined> | T | undefined;

  private update = async (data: ProvidersData) => {
    try {
      const current = await this.retrieveData(data);
      if(current === undefined)
        return;

      // If hasChanged is not defined, we assume that the user wants to always emit the current value
      if (this.hasChanged === undefined)
        this.observer?.next?.({ current });

      // Emit if the value has changed
      if (this.hasChanged?.(current, this.previous))
        this.observer?.next?.({ current, previous: this.previous });

      this.previous = current;
    } catch (error) {
      this.observer?.error?.(error);
    }
  };
}
