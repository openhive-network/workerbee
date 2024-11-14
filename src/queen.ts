import type { Observer, Unsubscribable } from "rxjs";

import { Resolver } from "./chain-observers/resolver";
import { CollectorsOptions, ProvidersMediator } from "./chain-observers/providers-mediator";
import type { WorkerBee } from "./bot";
import { operation } from "@hiveio/wax";
import { OperationFilter } from "./chain-observers/filters/operations-filter";

type RequireFilterType<T> = T extends {
  registerFilter: any;
  unregisterFilter: any
} ? T : never;

type RegisterArgs<T> = T extends {
  registerFilter: infer RegisterOptions;
  unregisterFilter: infer UnRegisterOptions;
} ? (
  RegisterOptions extends UnRegisterOptions ? (RegisterOptions extends (arg0: (data: any) => void, ...args: infer OtherOptions) => void ? OtherOptions : never) : never
) : never;

export class QueenBee {
  private mediator = new ProvidersMediator(this.worker);

  public constructor(
    private readonly worker: WorkerBee
  ) {}

  private currentResolver = new Resolver();
  private resolvers: Resolver[] = [];
  private options: Record<string, any> | CollectorsOptions = {};

  private pushFilter<T>(FilterClassType: RequireFilterType<T>, ...args: RegisterArgs<T>): this {
    this.currentResolver.push({
      subscribe: (observer: Observer<any>) => {
        FilterClassType.registerFilter(data => {
          observer.next(data);
        }, ...args as any[]);

        return {
          unsubscribe: () => {
            FilterClassType.unregisterFilter(data => {
              observer.next(data);
            },  ...args as any[]);
          }
        };
      }
    });

    return this;
  }

  public subscribe(observer: Observer<any>): Unsubscribable {
    if (this.currentResolver.hasSubscribables)
      this.resolvers.push(this.currentResolver);

    this.mediator.registerListener(observer, this.resolvers, this.options);

    return {
      unsubscribe: () => {
        for(const resolver of this.resolvers)
          resolver.unsubscribe();
      }
    };
  }

  public get or() {
    if (this.currentResolver.hasSubscribables) {
      this.resolvers.push(this.currentResolver);
      this.currentResolver = new Resolver();
    }

    return this;
  }

  public onOperationType(operationType: keyof operation): this {
    this.pushFilter(OperationFilter, operationType);

    return this;
  }
}
