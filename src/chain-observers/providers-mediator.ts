import { type Observer } from "rxjs";
import { AccountCollector } from "./collectors/account.collector";
import { BlockCollector } from "./collectors/block.collector";
import { DataCollectorBase } from "./collectors/collector-base";
import { AccountProvider } from "./providers/account.provider";
import { BlockProvider } from "./providers/block.provider";
import { DataProviderBase } from "./providers/provider-base";
import { TransactionProvider } from "./providers/transaction.provider";
import type { IBlockData } from "../interfaces";
import { WorkerBee } from "src/bot";
import { FilterContainer } from "./filter-container";

export type CollectorsData = {
  [K in keyof ProvidersMediator["availableCollectors"]]: ReturnType<ProvidersMediator["availableCollectors"][K]["fetchData"]>
};

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

export type CollectorsOptions = UnionToIntersection<{
    [K in keyof ProvidersMediator["availableCollectors"]]: Parameters<ProvidersMediator["availableCollectors"][K]["pushOptions"]>[0];
}[keyof ProvidersMediator["availableCollectors"]]>;

export type CollectorsOptionsForObservers = Record<string, any> | {
  [K in keyof ProvidersMediator["availableCollectors"]]: Parameters<ProvidersMediator["availableCollectors"][K]["pushOptions"]>[0];
}[keyof ProvidersMediator["availableCollectors"]];

export type ProvidersData = {
  [K in keyof ProvidersMediator["availableProviders"]]: ReturnType<ProvidersMediator["availableProviders"][K]["parseData"]>
};

export type ListenerType = (data: ProvidersData) => void;

export class ProvidersMediator {
  public constructor(
    private readonly worker: WorkerBee
  ) {
    this.worker.on("block", this.notify.bind(this));
  }

  private availableProviders = {
    block: new BlockProvider(this),
    transactions: new TransactionProvider(this),
    accounts: new AccountProvider(this)
  } satisfies Record<string, DataProviderBase>;

  private availableCollectors = {
    block: new BlockCollector(this),
    accounts: new AccountCollector(this)
  } satisfies Record<string, DataCollectorBase>;

  private filters = new Map<Partial<Observer<any>>, FilterContainer[]>();

  public cachedBlock!: IBlockData;

  public get chain (): Exclude<WorkerBee['chain'], undefined> {
    return this.worker.chain!;
  }

  public aggregate() {
    // Aggregate required providers from all filter containers
    const requiredProviders = new Set<keyof ProvidersData>();
    for(const [, filters] of this.filters)
      for(const filter of filters)
        for(const aggregate of filter.aggregate())
          requiredProviders.add(aggregate);

    return [...requiredProviders];
  }

  // This should be called on new block:
  public notify(blockData: IBlockData) {
    this.cachedBlock = blockData;

    const requiredProviders = this.aggregate();

    const collectorsData: CollectorsData = {} as CollectorsData;

    for (const key in this.availableCollectors) {
      const collectorName = key as keyof ProvidersMediator["availableCollectors"];

      collectorsData[collectorName] = this.availableCollectors[collectorName].fetchData() as any;
    }

    const providersData: ProvidersData = {} as ProvidersData;

    for (const key in this.availableProviders) {
      const providerName = key as keyof ProvidersMediator["availableProviders"];

      providersData[providerName] = this.availableProviders[providerName].parseData(collectorsData) as any;
    }

    // Start providing data to filters
    for(const [listener, filters] of this.filters.entries())
      // Apply OR on all filter containers waiting for the first to finish
      Promise.race(filters.map(resolver => resolver.match(providersData))).then(data => {
        // Call user listener if exists
        listener.next?.(data);

        // Cancel all of the filters (canceling the resolved filters does not afect the final result)
        for(const filter of filters)
          filter.cancel();
      }).catch(listener.error ?? (() => {})); // On any error call user error listener if exists
  }

  public registerListener(listener: Partial<Observer<any>>, filters: FilterContainer[]) {
    this.filters.set(listener, filters);
  }

  public unregisterListener(listener: Partial<Observer<any>>) {
    const options = this.filters.get(listener);
    if (!options)
      return;

    this.filters.delete(listener);
  }
}
