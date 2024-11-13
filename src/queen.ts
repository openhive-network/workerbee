import type { Observer, Unsubscribable } from "rxjs";

import { Resolver } from "./chain-observers/resolver";
import { ProvidersMediator } from "./chain-observers/providers-mediator";

export class QueenBee {
  private mediator = new ProvidersMediator();

  public constructor() {}

  public currentResolver = new Resolver();
  public resolvers: Resolver[] = [];

  public subscribe(observer: Observer<any>): Unsubscribable {
    if (this.currentResolver.nextFns.length > 0)
      this.resolvers.push(this.currentResolver);

    this.mediator.registerListener(observer, this.resolvers)

    return {
      unsubscribe: () => {}
    };
  }

  public get or() {
    if (this.currentResolver.nextFns.length > 0) {
      this.resolvers.push(this.currentResolver);
      this.currentResolver = new Resolver();
    }

    return this;
  }

  public onBlockNumber(number: number) {
    this.currentResolver.push()
  }
}
