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
import { FilterBase } from "./filters/filter-base";
import { OperationFilter } from "./filters/operations-filter";
import { Resolver } from "./resolver";

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

  private availableFilters: Array<FilterBase> = [
    new OperationFilter()
  ];

  private resolvers = new Map<Resolver[], { options: Record<string, any> | CollectorsOptions, listener: Observer<any> }>();

  public cachedBlock!: IBlockData;

  public get chain (): Exclude<WorkerBee['chain'], undefined> {
    return this.worker.chain!;
  }

  // This should be called on new block:
  public notify(blockData: IBlockData) {
    this.cachedBlock = blockData;

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

    for(const resolvers of this.resolvers.keys())
      for(const resolver of resolvers)
        resolver.initPromises();

    void this.applyFilters(providersData);

    for(const [resolvers, { listener }] of this.resolvers.entries())
      Promise.race(resolvers.map(resolver => resolver.startResolve())).then(listener.next).catch(listener.error);
  }

  private async applyFilters(data: ProvidersData) {
    for (const filter of this.availableFilters)
      filter.parse(data).catch(error => {
        this.worker.emit("error", error);
      });
  }

  public registerListener(listener: Observer<any>,resolvers: Resolver[], options: Record<string, any> | CollectorsOptions) {
    for (const key in this.availableCollectors) {
      const collectorName = key as keyof ProvidersMediator["availableCollectors"];

      this.availableCollectors[collectorName].pushOptions(options as any);
    }

    this.resolvers.set(resolvers, {
      options,
      listener
    });
  }

  public unregisterListener(resolvers: Resolver[]) {
    const options = this.resolvers.get(resolvers);
    if (!options)
      return;

    // Propagate options unregister to all of the collectors
    for (const key in this.availableCollectors) {
      const collectorName = key as keyof ProvidersMediator["availableCollectors"];

      this.availableCollectors[collectorName].popOptions(options.options as any);
    }

    this.resolvers.delete(resolvers);
  }
}
