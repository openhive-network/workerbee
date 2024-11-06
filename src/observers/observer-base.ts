import type { Observer, Subscribable, Unsubscribable } from "rxjs";
import type { WorkerBee } from "../bot";
import { WorkerBeeError } from "../errors";
import { IWorkerBeeRegisterEvents } from "./register";

export type TSubscribableObserverOptions<T, OtherMetadata extends object = {}> = OtherMetadata & { current: T, previous?: T };

export type TEventTypes = {
  [key in keyof IWorkerBeeRegisterEvents as `listenFor${Capitalize<string & key>}`]?: boolean;
};

type RemoveOptional<T> = {
  [K in keyof T as {} extends Pick<T, K> ? never : K]: T[K];
};

export type TDataFromEvents<T extends TEventTypes> = {
  [K in keyof RemoveOptional<T> as Uncapitalize<string & K> extends `listenFor${infer Event}`
    ? Uncapitalize<Event>
    : never]: K extends `listenFor${infer Event}`
    ? (IWorkerBeeRegisterEvents[Uncapitalize<Event> extends keyof IWorkerBeeRegisterEvents ? Uncapitalize<Event> : never] extends (data: infer R) => void ?
      R
      : never)
    : never;
};

export type TObserverFor<T extends Subscribable<any>> = Pick<T, "subscribe">;

/**
 * Generic class for creating observers that can be subscribed to.
 */
export abstract class ObserverBase<
  T,
  TExtendingClass extends TEventTypes,
  OtherOptions extends object = {},
> implements TEventTypes, Subscribable<TSubscribableObserverOptions<T, TDataFromEvents<TExtendingClass>>> {
  public constructor(
    protected readonly worker: WorkerBee,
    protected readonly options: OtherOptions
  ) {}

  public readonly listenForBlock?: boolean;
  public readonly listenForTransaction?: boolean;
  public readonly listenForDgpo?: boolean;
  public readonly listenForAccount?: boolean;
  public readonly listenForRc?: boolean;

  protected observer?: Partial<Observer<TSubscribableObserverOptions<T, TDataFromEvents<TExtendingClass>>>>;

  private listenerFn?: (...args: any[]) => void;

  private get listenersRegistered(): keyof IWorkerBeeRegisterEvents {
    if (this.listenForBlock)
      return "block";
    else if (this.listenForTransaction)
      return "transaction";
    else if (this.listenForDgpo)
      return "dgpo";
    else if (this.listenForAccount)
      return "account";
    else if (this.listenForRc)
      return "rc";

    throw new WorkerBeeError("No listeners registered");
  }

  private registerListeners(): void {
    const listener = this.listenersRegistered;

    this.worker.register.on(listener, this.listenerFn = (data: any) => {
      this.update({ [listener]: data } as TDataFromEvents<TExtendingClass>);
    }, this.options);
  }

  private unregisterListeners(): void {
    this.worker.register.off(this.listenersRegistered, this.listenerFn!, this.options);

    this.listenerFn = undefined;
  }

  public subscribe(observer: Partial<Observer<TSubscribableObserverOptions<T, TDataFromEvents<TExtendingClass>>>>): Unsubscribable {
    this.observer = observer;

    this.registerListeners();

    return {
      unsubscribe: () => {
        this.unregisterListeners();

        this.observer?.complete?.();

        this.observer = undefined;
      }
    }
  }

  protected previous?: T;

  protected abstract hasChanged(current?: T, previous?: T): boolean;

  protected abstract retrieveData(metadata: TDataFromEvents<TExtendingClass>): T | Promise<T | undefined | void> | undefined | void;

  protected update(data: TDataFromEvents<TExtendingClass>): void {
    (async () => {
      const current = await this.retrieveData(data);
      if(current === undefined)
        return;

      if (this.hasChanged(current, this.previous))
        this.observer?.next?.({ current, previous: this.previous, ...data });

      this.previous = current;
    })().catch(error => { this.observer?.error?.(error); });
  }
}
