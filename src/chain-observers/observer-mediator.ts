import { type Observer } from "../types/subscribable";
import { DataEvaluationContext } from "./factories/data-evaluation-context";
import { EClassifierOrigin, type FactoryBase } from "./factories/factory-base";
import { FilterBase } from "./filters/filter-base";
import { ProviderBase } from "./providers/provider-base";

export type ListenerType = (data: DataEvaluationContext) => void;

export class ObserverMediator {
  public constructor(
    private readonly factory: FactoryBase
  ) {}

  private filters = new Map<Partial<Observer<any>>, { filter: FilterBase; providers: Iterable<ProviderBase>; }>();

  public notify() {
    this.factory.preNotify(this);

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

    this.factory.postNotify(this, context);
  }

  public registerListener(listener: Partial<Observer<any>>, filter: FilterBase, providers: Iterable<ProviderBase>) {
    this.filters.set(listener, { filter, providers });

    for(const classifier of filter.usedContexts())
      this.factory.pushClassifier(classifier, EClassifierOrigin.FILTER);

    for(const classifier of providers)
      for(const usedContext of classifier.usedContexts())
        this.factory.pushClassifier(usedContext, EClassifierOrigin.PROVIDER);
  }

  public unregisterListener(listener: Partial<Observer<any>>) {
    const filter = this.filters.get(listener);
    if (!filter)
      return;

    for(const classifier of filter.filter.usedContexts())
      this.factory.popClassifier(classifier, EClassifierOrigin.FILTER);

    for(const classifier of filter.providers)
      for(const usedContext of classifier.usedContexts())
        this.factory.popClassifier(usedContext, EClassifierOrigin.PROVIDER);

    this.filters.delete(listener);

    listener.complete?.();
  }

  public unregisterAllListeners() {
    for(const listener of this.filters.keys())
      this.unregisterListener(listener);
  }
}
