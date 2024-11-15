import { operation } from "@hiveio/wax";
import type { Observer, Unsubscribable } from "rxjs";

import { WorkerBee } from "./bot";
import { FilterContainer } from "./chain-observers/filter-container";
import { OperationFilter } from "./chain-observers/filters/operations-filter";
import { TransactionIdFilter } from "./chain-observers/filters/transaction-id-filter";
import { ProvidersMediator } from "./chain-observers/providers-mediator";

export class QueenBee {
  private mediator = new ProvidersMediator(this.worker);

  public constructor(
    private readonly worker: WorkerBee
  ) {}

  private currentFilterContainer = new FilterContainer();
  private filterContainers: FilterContainer[] = [];

  public subscribe(observer: Partial<Observer<any>>): Unsubscribable {
    if (this.currentFilterContainer.hasUnderlyingFilters)
      this.filterContainers.push(this.currentFilterContainer);

    const committedFilters = this.filterContainers;

    this.mediator.registerListener(observer, committedFilters);

    this.filterContainers = [];
    this.currentFilterContainer = new FilterContainer();

    return {
      unsubscribe: () => {
        this.mediator.unregisterListener(observer);

        for(const resolver of committedFilters)
          resolver.cancel();
      }
    };
  }

  public get or() {
    if (this.currentFilterContainer.hasUnderlyingFilters) {
      this.filterContainers.push(this.currentFilterContainer);
      this.currentFilterContainer = new FilterContainer();
    }

    return this;
  }

  public onOperationType(operationType: keyof operation): this {
    this.currentFilterContainer.pushFilter(new OperationFilter(operationType));

    return this;
  }

  public onTransactionId(transactionId: string): this {
    this.currentFilterContainer.pushFilter(new TransactionIdFilter(transactionId));

    return this;
  }
}
