import { WorkerBee } from "../bot";
import { type Observer } from "../types/subscribable";
import { DataEvaluationContext } from "./factories/data-evaluation-context";
import { FactoryBase } from "./factories/factory-base";
import { JsonRpcFactory } from "./factories/jsonrpc/factory";
import { FilterBase } from "./filters/filter-base";
import { ProviderBase } from "./providers/provider-base";

export type ListenerType = (data: DataEvaluationContext) => void;

export type FactoryBaseConstructor = new (worker: WorkerBee) => FactoryBase;

export class ObserverMediator {
  private readonly factory: FactoryBase;

  public constructor(
    worker: WorkerBee,
    factory: FactoryBaseConstructor = JsonRpcFactory
  ) {
    this.factory = new factory(worker);
  }

  private filters = new Map<Partial<Observer<any>>, { filter: FilterBase; providers: ProviderBase[]; }>();

  public notify() {
    const context = this.factory.collect();

    // Start providing parsed, cached data to filters
    for(const [listener, { filter, providers }] of this.filters.entries())
      filter.match(context).then(async(matched) => {
        if(!matched)
          return;

        // Join all providers data for user (1 level nested)
        const providedData = {};
        for(const provider of providers) {
          const providerResult = await provider.provide(context);
          for(const key in providerResult)
            if (Array.isArray(providerResult[key]))
              providedData[key] = (providedData[key] ?? []).concat(providerResult[key]);
            else
              providedData[key] = { ...(providedData[key] ?? {}), ...providerResult[key] };
        }

        listener.next?.(providedData);
      }).catch(error => listener.error?.(error));
  }

  public registerListener(listener: Partial<Observer<any>>, filter: FilterBase, providers: ProviderBase[]) {
    this.filters.set(listener, { filter, providers });

    for(const classifier of filter.usedContexts())
      this.factory.pushClassifier(classifier);

    for(const classifier of providers)
      for(const usedContext of classifier.usedContexts())
        this.factory.pushClassifier(usedContext);
  }

  public unregisterListener(listener: Partial<Observer<any>>) {
    const filter = this.filters.get(listener);
    if (!filter)
      return;

    for(const classifier of filter.filter.usedContexts())
      this.factory.popClassifier(classifier);

    for(const classifier of filter.providers)
      for(const usedContext of classifier.usedContexts())
        this.factory.popClassifier(usedContext);

    this.filters.delete(listener);
  }

  public unregisterAllListeners() {
    for(const listener of this.filters.keys())
      this.unregisterListener(listener);
  }
}
