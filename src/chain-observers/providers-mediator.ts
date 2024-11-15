import { type Observer } from "rxjs";
import { AccountCollector } from "./collectors/account.collector";
import { BlockCollector } from "./collectors/block.collector";
import { DataCollectorBase } from "./collectors/collector-base";
import { AccountProvider } from "./providers/account.provider";
import { BlockProvider } from "./providers/block.provider";
import { DataProviderBase } from "./providers/provider-base";
import { TransactionProvider } from "./providers/transaction.provider";
import type { IBlockData } from "../interfaces";
import { DEFAULT_BLOCK_INTERVAL_TIMEOUT, WorkerBee } from "src/bot";
import { FilterContainer } from "./filter-container";
import { FilterTimeoutError } from "src/errors";

export type CollectorsData = {
  [K in keyof ProvidersMediator["availableCollectors"]]: ReturnType<ProvidersMediator["availableCollectors"][K]["fetchData"]>
};

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

export type CollectorsOptions = UnionToIntersection<{
  [K in keyof ProvidersMediator["availableCollectors"]]: Parameters<ProvidersMediator["availableCollectors"][K]["pushOptions"]>[0];
}[keyof ProvidersMediator["availableCollectors"]]>;

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

  private cachedRequiredProviders = new Set<keyof ProvidersData>();
  private cachedRequiredCollectors = new Set<keyof CollectorsData>();

  private cacheRequiredStructures() {
    // Aggregate required providers from all filter containers
    const requiredProviders = new Set<keyof ProvidersData>();
    for(const [, filters] of this.filters)
      for(const filter of filters)
        for(const aggregate of filter.aggregate())
          requiredProviders.add(aggregate);

    // Aggregate required collectors from all required providers
    const requiredCollectors = new Set<keyof CollectorsData>();
    for(const provider of requiredProviders)
      for(const collector of this.availableProviders[provider].aggregate())
        requiredCollectors.add(collector);

    this.cachedRequiredProviders = requiredProviders;
    this.cachedRequiredCollectors = requiredCollectors;
  }

  // This should be called on new block:
  public notify(blockData: IBlockData) {
    this.cachedBlock = blockData;

    // Fetch data from collectors
    const collectorsData: CollectorsData = {} as CollectorsData;
    for (const collectorName of this.cachedRequiredCollectors)
      collectorsData[collectorName] = this.availableCollectors[collectorName].fetchData() as any;

    // Parse data from collectors
    const providersData: ProvidersData = {} as ProvidersData;
    for (const providerName of this.cachedRequiredProviders)
      providersData[providerName] = this.availableProviders[providerName].parseData(collectorsData) as any;

    // Start providing parsed, cached data to filters
    for(const [listener, filters] of this.filters.entries())
      // Apply OR on all filter containers waiting for the first to finish
      Promise.race([
        new Promise<void>((_, reject) => {
          setTimeout(reject, DEFAULT_BLOCK_INTERVAL_TIMEOUT, new FilterTimeoutError('Filter timed out'));
        }),
        ...filters.map(resolver => resolver.match(providersData))
      ]).then(data => {
        // Call user listener if exists
        listener.next?.(data);

        // Cancel all of the filters (canceling the resolved filters does not afect the final result)
        for(const filter of filters)
          filter.cancel();
      }).catch(error => {
        // Do not call user error listener if the error is an internal timeout error
        if(typeof error === "object" && error instanceof FilterTimeoutError)
          return;

        listener.error?.(error);
      }); // On any error call user error listener if exists
  }

  public registerListener(listener: Partial<Observer<any>>, filters: FilterContainer[]) {
    this.filters.set(listener, filters);

    this.cacheRequiredStructures();
  }

  public unregisterListener(listener: Partial<Observer<any>>) {
    const options = this.filters.get(listener);
    if (!options)
      return;

    listener.complete?.();

    this.filters.delete(listener);

    this.cacheRequiredStructures();
  }
}
