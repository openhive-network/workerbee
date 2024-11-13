import { type Observer } from "rxjs";
import { AccountCollector } from "./collectors/account.collector";
import { BlockCollector } from "./collectors/block.collector";
import { DataCollectorBase } from "./collectors/collector-base";
import { AccountProvider } from "./providers/account.provider";
import { BlockProvider } from "./providers/block.provider";
import { DataProviderBase } from "./providers/provider-base";
import { TransactionProvider } from "./providers/transaction.provider";

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
  private availableProviders = {
    block: new BlockProvider(),
    transactions: new TransactionProvider(),
    accounts: new AccountProvider()
  } satisfies Record<string, DataProviderBase>;

  private availableCollectors = {
    block: new BlockCollector(),
    accounts: new AccountCollector()
  } satisfies Record<string, DataCollectorBase>;

  // For better type-compatibility we could use WeakMap, but they do not allow iteration over underlying Nodes
  private listeners = new Map<ListenerType, Record<string, any>>();

  // This should be called on new block:
  public notify() {
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

    this.callListeners(providersData);
  }

  private callListeners(data: ProvidersData) {
    for (const listener in this.listeners.keys())
      queueMicrotask(() => {
        // Schedule a macrotask - this is necessary to prevent the event loop from being blocked before all data providers are locked on current event values
        setTimeout(() => {
          (listener as unknown as ListenerType)(data);
        }, 0);
      });

  }

  public registerListener(handler: Observer<any>, options: CollectorsOptionsForObservers) {
    // Propagate options to all of the collectors
    for (const key in this.availableCollectors) {
      const collectorName = key as keyof ProvidersMediator["availableCollectors"];

      this.availableCollectors[collectorName].pushOptions(options as any);
    }

    this.listeners.set(listener, options);
  }

  public unregisterListener(listener: ListenerType) {
    const options = this.listeners.get(listener);
    if (!options)
      return;

    // Propagate options unregister to all of the collectors
    for (const key in this.availableCollectors) {
      const collectorName = key as keyof ProvidersMediator["availableCollectors"];

      this.availableCollectors[collectorName].popOptions(options as any);
    }

    this.listeners.delete(listener);
  }
}
